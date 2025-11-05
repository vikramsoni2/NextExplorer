const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { auth: eocAuth } = require('express-openid-connect');
const session = require('express-session');
const pinoHttp = require('pino-http');

const {
  port,
  directories,
  corsOptions,
  public: publicConfig,
  auth: envAuthConfig,
  logging,
} = require('./config/index');
const { ensureDir } = require('./utils/fsUtils');
const registerRoutes = require('./routes');
const authRoutes = require('./routes/auth');
const authMiddleware = require('./middleware/authMiddleware');
const { createOrUpdateOidcUser, deriveRolesFromClaims } = require('./services/users');
const { fetchUserInfoClaims } = require('./services/oidcService');
const logger = require('./utils/logger');

const app = express();
let server = null;

// Trust proxy configuration (validated via Zod)
try {
  const { getTrustProxySetting } = require('./config/trustProxy');
  const tp = getTrustProxySetting();
  if (tp.set) {
    app.set('trust proxy', tp.value);
  }
  if (tp.message) {
    logger.info({ message: tp.message }, 'Trust proxy configured');
  } else {
    logger.debug('Trust proxy not explicitly configured');
  }
} catch (e) {
  logger.warn({ err: e }, 'Failed to configure trust proxy');
}

if (logging.enableHttpLogging) {
  app.use(
    pinoHttp({
      logger: logger.child({ context: 'http' }),
      customLogLevel: (res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return logging.isDebug ? 'debug' : 'info';
      },
    })
  );
}

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Keep request logging minimal; avoid noisy per-request logs in production
// (If needed, plug a logger like morgan at the app level.)

const bootstrap = async () => {
  logger.debug('Bootstrap start');
  try {
    await ensureDir(directories.cache);
    logger.debug({ dir: directories.cache }, 'Cache directory ensured');
  } catch (error) {
    logger.warn(
      { directory: directories.cache, err: error },
      'Unable to prepare cache directory'
    );
  }

  try {
    await ensureDir(directories.thumbnails);
    logger.debug({ dir: directories.thumbnails }, 'Thumbnails directory ensured');
  } catch (error) {
    logger.warn(
      { directory: directories.thumbnails, err: error },
      'Unable to prepare thumbnail directory'
    );
  }

  // Express OpenID Connect (provider-agnostic: Keycloak, Authentik, Authelia)
  try {
    logger.debug('Configuring Express OpenID Connect');
    const oidc = (envAuthConfig && envAuthConfig.oidc) || {};
    const scopes = Array.isArray(oidc.scopes) && oidc.scopes.length ? oidc.scopes : ['openid', 'profile', 'email'];
    const scopeParam = Array.from(new Set(['openid', ...scopes])).join(' ');
    logger.debug({ scopes, scopeParam }, 'OIDC scopes resolved');

    // Determine baseURL from callbackUrl or PUBLIC_URL
    let baseURL = null;
    try {
      if (oidc.callbackUrl && /^https?:\/\//i.test(oidc.callbackUrl)) {
        const u = new URL(oidc.callbackUrl);
        baseURL = u.origin;
        logger.debug({ baseURL, source: 'callbackUrl' }, 'Derived baseURL');
      } else if (publicConfig?.url) {
        const u = new URL(publicConfig.url);
        baseURL = u.origin;
        logger.debug({ baseURL, source: 'PUBLIC_URL' }, 'Derived baseURL');
      }
    } catch (_) {
      baseURL = null;
      logger.debug('Failed to derive baseURL');
    }

    const sessionSecret = (envAuthConfig && envAuthConfig.sessionSecret)
      || process.env.SESSION_SECRET
      || crypto.randomBytes(32).toString('hex');
    logger.debug({ hasSessionSecret: Boolean(sessionSecret) }, 'Session secret resolved');

    // Make cookies secure only if the site is served over HTTPS
    let cookieSecure = false;
    try {
      const urlForSecurity = baseURL || (publicConfig && publicConfig.url) || '';
      if (urlForSecurity) {
        cookieSecure = new URL(urlForSecurity).protocol === 'https:';
      }
    } catch (_) { cookieSecure = false; }
    logger.debug({ cookieSecure }, 'Express session cookie security');

    // Always enable Express session for local auth if a secret is provided
    // Use "auto" so cookies are Secure only when connection is HTTPS.
    app.use(session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: 'auto',
      },
    }));
    logger.debug('Express session middleware configured');

    const eocEnabled = Boolean(oidc.enabled && oidc.issuer && oidc.clientId && sessionSecret && baseURL);
    logger.debug({ enabled: eocEnabled, issuer: !!oidc.issuer, clientId: !!oidc.clientId, baseURL: !!baseURL }, 'EOC enablement check');

    // Compute a safe default for the OIDC session cookie.
    // When baseURL is https, mark cookie as secure; otherwise keep it non-secure for dev.
    const eocCookieSecure = (() => {
      try {
        if (baseURL) {
          const u = new URL(baseURL);
          return u.protocol === 'https:';
        }
      } catch (_) {}
      return false;
    })();
    logger.debug({ eocCookieSecure }, 'OIDC session cookie security');

    if (eocEnabled) {
      app.use(eocAuth({
        authRequired: false,
        auth0Logout: false,
        idpLogout: false,
        issuerBaseURL: oidc.issuer,
        baseURL,
        clientID: oidc.clientId,
        clientSecret: oidc.clientSecret || undefined,
        secret: sessionSecret,
        authorizationParams: {
          response_type: 'code',
          scope: scopeParam,
        },
        // Sync OIDC users into the database on login using the UserInfo endpoint
        // See auth0/express-openid-connect#197: req.oidc.fetchUserInfo() is not
        // available here because the session is not hydrated yet. 
        afterCallback: async (req, res, session) => {
          logger.debug('afterCallback: start');
          try {
            const persistIssuer = oidc.issuer;
            const accessToken = session?.access_token;

            // Avoid logging the full req.oidc object (may contain methods or sensitive info).
            // Instead, log compact boolean flags so it's clear why fetches are attempted.
            const hasOidc = Boolean(req?.oidc);
            logger.debug({ hasOidc, accessTokenPresent: Boolean(accessToken), persistIssuer }, 'OIDC user login state');

            let claims = {};

            // Prefer already-decoded user claims if available on req.oidc.user
            const hasReqUser = Boolean(req?.oidc?.user && req.oidc.user.sub);
            logger.debug({ hasReqUser }, 'afterCallback: req.oidc.user presence');
            if (hasReqUser) {
              claims = req.oidc.user;
              logger.debug('afterCallback: using req.oidc.user');
            }

            if (accessToken && persistIssuer) {
              logger.debug('afterCallback: fetching userinfo via direct HTTP');
              // Work around express-openid-connect#197 by invoking the userinfo endpoint directly
              const directClaims = await fetchUserInfoClaims({ issuer: persistIssuer, accessToken, userInfoURL: oidc.userInfoURL });
              if (directClaims && directClaims.sub) {
                claims = directClaims;
                logger.debug('afterCallback: direct userinfo fetch succeeded');
              }
            }

            // Do not call req.oidc.fetchUserInfo() here: it requires a hydrated session
            // which is not yet available within afterCallback (see issue #197)


            if ((!claims || !claims.sub) && session?.id_token_claims) {
              logger.debug('afterCallback: falling back to id_token_claims');
              // As a final fallback, inspect cached claims provided by express-openid-connect
              claims = session.id_token_claims;
              logger.debug(claims, 'afterCallback: id_token_claims content');
            } else if ((!claims || !claims.sub) && session?.claims) {
              logger.debug('afterCallback: falling back to session.claims');
              claims = session.claims;
              logger.debug(claims, 'afterCallback: session.claims content');
            }

            const sub = claims && claims.sub ? claims.sub : null;
            if (!sub) {
              logger.debug('afterCallback: no usable claims found; skipping user sync');
              return session;
            }

            const email = claims.email || null;
            const preferredUsername = claims.preferred_username || claims.username || email || sub;
            const displayName = claims.name || preferredUsername || null;
            const roles = deriveRolesFromClaims(claims, envAuthConfig?.oidc?.adminGroups);

            logger.debug({ sub, preferredUsername, displayName, email, roles }, 'afterCallback: derived user info');

            logger.debug({ sub, hasEmail: Boolean(email) }, 'afterCallback: persisting OIDC user');
            await createOrUpdateOidcUser({
              issuer: persistIssuer,
              sub,
              username: preferredUsername,
              displayName,
              email,
              roles,
            });
            logger.debug('afterCallback: user persisted/synced');
          } catch (e) {
            logger.warn({ err: e }, 'afterCallback user sync failed');
          }
          logger.debug('afterCallback: complete');
          return session;
        },
        // Align cookie behavior with typical SPA usage
        session: {
          rolling: true,
          cookie: {
            sameSite: 'Lax',
            secure: eocCookieSecure,
            httpOnly: true,
          },
        },
      }));

      logger.info('Express OpenID Connect is configured');
      logger.debug('EOC middleware mounted');
    } else {
      logger.info('Express OpenID Connect not configured (missing issuer/client/baseURL/secret or disabled)');
      logger.debug({
        enabled: Boolean(oidc.enabled),
        hasIssuer: Boolean(oidc.issuer),
        hasClientId: Boolean(oidc.clientId),
        hasSecret: Boolean(sessionSecret),
        hasBaseURL: Boolean(baseURL),
      }, 'EOC configuration details');
    }
  } catch (e) {
    logger.warn({ err: e }, 'Failed to configure Express OpenID Connect');
  }

  // One-time warning if HTTPS is detected but OIDC cookie is not marked secure.
  // Keeps the app running without special env vars, but educates operators.
  let warnedInsecureOverHttps = false;
  app.use((req, _res, next) => {
    try {
      const isHttps = req.secure || (req.headers['x-forwarded-proto'] || '').toString().split(',')[0].trim() === 'https';
      if (isHttps && !warnedInsecureOverHttps) {
        // express-session uses secure: 'auto' already; warn only for potential OIDC mismatch
        warnedInsecureOverHttps = true;
        logger.warn('HTTPS detected. Ensure upstream proxy is trusted and OIDC cookies are set secure when OIDC is enabled.');
      } else if (!isHttps) {
        logger.debug('Non-HTTPS request detected');
      }
    } catch (_) {}
    next();
  });

  app.use('/api/auth', authRoutes);
  logger.debug('Mounted /api/auth routes');
  app.use(authMiddleware);
  logger.debug('Mounted auth middleware');

  app.use('/static/thumbnails', express.static(directories.thumbnails));
  logger.debug('Mounted /static/thumbnails');
  registerRoutes(app);
  logger.debug('Registered application routes');

  const frontendDir = path.resolve(__dirname, 'public');
  const indexFile = path.join(frontendDir, 'index.html');

  if (fs.existsSync(frontendDir) && fs.existsSync(indexFile)) {
    app.use(express.static(frontendDir));
    logger.debug({ frontendDir, indexFile }, 'Mounted static frontend');
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/static/thumbnails')) {
        return next();
      }

      if (!['GET', 'HEAD'].includes(req.method)) {
        return next();
      }

      res.sendFile(indexFile);
    });
  }

  server = app.listen(port, '0.0.0.0', () => {
    logger.info({ port }, 'Server is running');
    logger.debug('HTTP server listen callback executed');
  });
};

bootstrap().catch((error) => {
  logger.error({ err: error }, 'Failed to bootstrap application');
});

module.exports = {
  app,
  get server() {
    return server;
  },
};

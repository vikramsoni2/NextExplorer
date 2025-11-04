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
  try {
    await ensureDir(directories.cache);
  } catch (error) {
    logger.warn(
      { directory: directories.cache, err: error },
      'Unable to prepare cache directory'
    );
  }

  try {
    await ensureDir(directories.thumbnails);
  } catch (error) {
    logger.warn(
      { directory: directories.thumbnails, err: error },
      'Unable to prepare thumbnail directory'
    );
  }

  // Express OpenID Connect (provider-agnostic: Keycloak, Authentik, Authelia)
  try {
    const oidc = (envAuthConfig && envAuthConfig.oidc) || {};
    const scopes = Array.isArray(oidc.scopes) && oidc.scopes.length ? oidc.scopes : ['openid', 'profile', 'email'];
    const scopeParam = Array.from(new Set(['openid', ...scopes])).join(' ');

    // Determine baseURL from callbackUrl or PUBLIC_URL
    let baseURL = null;
    try {
      if (oidc.callbackUrl && /^https?:\/\//i.test(oidc.callbackUrl)) {
        const u = new URL(oidc.callbackUrl);
        baseURL = u.origin;
      } else if (publicConfig?.url) {
        const u = new URL(publicConfig.url);
        baseURL = u.origin;
      }
    } catch (_) {
      baseURL = null;
    }

    const sessionSecret = (envAuthConfig && envAuthConfig.sessionSecret)
      || process.env.SESSION_SECRET
      || crypto.randomBytes(32).toString('hex');

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

    const eocEnabled = Boolean(oidc.enabled && oidc.issuer && oidc.clientId && sessionSecret && baseURL);

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
        // Sync OIDC users into the database on login by decoding the ID token claims
        afterCallback: async (req, res, session) => {
          try {
            let claims = {};
            try {
              const { decodeJwt } = await import('jose');
              claims = session?.id_token ? decodeJwt(session.id_token) : {};
            } catch (_) { claims = {}; }

            const sub = claims && claims.sub ? claims.sub : null;
            if (!sub) return session;

            const email = claims.email || null;
            const preferredUsername = claims.preferred_username || claims.username || email || sub;
            const displayName = claims.name || preferredUsername || null;
            const roles = deriveRolesFromClaims(claims, envAuthConfig?.oidc?.adminGroups);

            const persistIssuer = oidc.issuer;
            await createOrUpdateOidcUser({
              issuer: persistIssuer,
              sub,
              username: preferredUsername,
              displayName,
              email,
              roles,
            });
          } catch (e) {
            logger.warn({ err: e }, 'afterCallback user sync failed');
          }
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
    } else {
      logger.info('Express OpenID Connect not configured (missing issuer/client/baseURL/secret or disabled)');
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
      }
    } catch (_) {}
    next();
  });

  app.use('/api/auth', authRoutes);
  app.use(authMiddleware);

  app.use('/static/thumbnails', express.static(directories.thumbnails));
  registerRoutes(app);

  const frontendDir = path.resolve(__dirname, 'public');
  const indexFile = path.join(frontendDir, 'index.html');

  if (fs.existsSync(frontendDir) && fs.existsSync(indexFile)) {
    app.use(express.static(frontendDir));
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

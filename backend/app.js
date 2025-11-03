const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { auth: eocAuth } = require('express-openid-connect');
const session = require('express-session');

const { port, directories, corsOptions, public: publicConfig, auth: envAuthConfig } = require('./config/index');
const { ensureDir } = require('./utils/fsUtils');
const registerRoutes = require('./routes');
const authRoutes = require('./routes/auth');
const authMiddleware = require('./middleware/authMiddleware');
const { createOrUpdateOidcUser, deriveRolesFromClaims } = require('./services/users');

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
    console.log(tp.message);
  }
} catch (e) {
  console.warn('Failed to configure trust proxy:', e?.message || e);
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
    console.warn(`Unable to prepare cache directory at ${directories.cache}:`, error.message);
  }

  try {
    await ensureDir(directories.thumbnails);
  } catch (error) {
    console.warn(`Unable to prepare thumbnail directory at ${directories.thumbnails}:`, error.message);
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
      || null;

    // Always enable Express session for local auth if a secret is provided
    if (sessionSecret) {
      app.use(session({
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        },
      }));
    }

    const eocEnabled = Boolean(oidc.enabled && oidc.issuer && oidc.clientId && sessionSecret && baseURL);

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
            console.warn('afterCallback user sync failed:', e?.message || e);
          }
          return session;
        },
        // Align cookie behavior with typical SPA usage
        session: {
          rolling: true,
          cookie: {
            sameSite: 'Lax',
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
          },
        },
      }));

      console.log('Express OpenID Connect is configured.');
    } else {
      console.log('Express OpenID Connect not configured (missing issuer/client/baseURL/secret or disabled).');
    }
  } catch (e) {
    console.warn('Failed to configure Express OpenID Connect:', e?.message || e);
  }

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
    console.log(`Server is running on port ${port}`);
  });
};

bootstrap().catch((error) => {
  console.error('Failed to bootstrap application:', error);
});

module.exports = {
  app,
  get server() {
    return server;
  },
};

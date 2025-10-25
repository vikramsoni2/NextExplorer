const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const { Issuer, Strategy: OidcStrategy } = require('openid-client');

const { auth: envAuthConfig } = require('../config/index');
const {
  getSettings,
} = require('./appConfigService');
const {
  verifyLocalCredentials,
  sanitizeUserForClient,
} = require('./authService');
const {
  findById,
  createOidcUser,
  updateUser,
} = require('./userStore');

const DEFAULT_SCOPES = ['openid', 'profile', 'email'];

const resolveSecurityConfig = async () => {
  const settings = await getSettings();
  const security = settings?.security || {};
  const envAuth = envAuthConfig || {};
  const envOidc = envAuth.oidc || {};
  const configOidc = security.oidc || {};

  const authEnabled = security.authEnabled !== false;
  const authMode = envAuth.authMode || security.authMode || 'local';
  const sessionSecret = envAuth.sessionSecret || security.sessionSecret || null;

  const oidcEnabled = envOidc.enabled != null
    ? Boolean(envOidc.enabled)
    : Boolean(configOidc.enabled);

  const mergeScopes = (envScopes, configScopes) => {
    if (Array.isArray(envScopes) && envScopes.length > 0) {
      return envScopes;
    }
    if (Array.isArray(configScopes) && configScopes.length > 0) {
      return configScopes;
    }
    return DEFAULT_SCOPES;
  };

  const oidc = {
    enabled: oidcEnabled,
    issuer: envOidc.issuer || configOidc.issuer || null,
    clientId: envOidc.clientId || configOidc.clientId || null,
    clientSecret: envOidc.clientSecret || configOidc.clientSecret || null,
    callbackUrl: envOidc.callbackUrl || configOidc.callbackUrl || null,
    scopes: mergeScopes(envOidc.scopes, configOidc.scopes),
  };

  return {
    authEnabled,
    authMode,
    sessionSecret,
    oidc,
  };
};

const configureLocalStrategy = () => {
  passport.use(new LocalStrategy(
    {
      usernameField: 'username',
      passwordField: 'password',
      session: true,
    },
    async (username, password, done) => {
      try {
        const user = await verifyLocalCredentials({ username, password });
        if (!user) {
          return done(null, false, { message: 'Invalid credentials.' });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    },
  ));
};

const configureOidcStrategy = async () => {
  const security = await resolveSecurityConfig();
  const oidc = security.oidc || {};

  if (!oidc.enabled) {
    return false;
  }

  if (!oidc.issuer || !oidc.clientId || !oidc.callbackUrl) {
    console.warn('OIDC configuration is incomplete; skipping OIDC strategy setup.');
    return false;
  }

  try {
    const issuer = await Issuer.discover(oidc.issuer);

    const client = new issuer.Client({
      client_id: oidc.clientId,
      client_secret: oidc.clientSecret || undefined,
      redirect_uris: [oidc.callbackUrl],
      response_types: ['code'],
    });

    passport.use('oidc', new OidcStrategy(
      {
        client,
        params: {
          scope: Array.isArray(oidc.scopes) ? oidc.scopes.join(' ') : DEFAULT_SCOPES.join(' '),
        },
        passReqToCallback: false,
      },
      async (tokenSet, userinfo, done) => {
        try {
          const claims = tokenSet?.claims?.() || {};
          const subject = claims.sub || userinfo?.sub;
          if (!subject) {
            throw new Error('OIDC response did not include a subject identifier.');
          }

          const issuerIdentifier = claims.iss || oidc.issuer;
          const username = userinfo?.preferred_username
            || userinfo?.email
            || claims.preferred_username
            || claims.email
            || subject;

          const displayName = userinfo?.name || claims.name || null;
          const email = userinfo?.email || claims.email || null;

          const user = await createOidcUser({
            issuer: issuerIdentifier,
            subject,
            username,
            displayName,
            email,
          });

          await updateUser(user.id, {
            displayName: displayName || user.displayName || null,
            email: email || user.email || null,
            lastLoginAt: new Date().toISOString(),
          });

          const persisted = await findById(user.id);
          return done(null, sanitizeUserForClient(persisted));
        } catch (error) {
          return done(error);
        }
      },
    ));
    return true;
  } catch (error) {
    console.error('Failed to configure OIDC strategy:', error);
    return false;
  }
};

passport.serializeUser((user, done) => {
  if (!user || !user.id) {
    done(new Error('Unable to serialize user without id.'));
    return;
  }
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await findById(id);
    if (!user) {
      done(null, false);
      return;
    }
    done(null, sanitizeUserForClient(user));
  } catch (error) {
    done(error);
  }
});

const initializePassport = async () => {
  configureLocalStrategy();
  await configureOidcStrategy();
  return passport;
};

module.exports = {
  passport,
  initializePassport,
  resolveSecurityConfig,
};

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const { Strategy: OpenIDConnectStrategy } = require('passport-openidconnect');
const http = require('http');
const https = require('https');

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
const DISCOVERY_TIMEOUT_MS = 5000;
const WELL_KNOWN_PATH = '/.well-known/openid-configuration';

const trimToNull = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const preferEnv = (envValue, configValue) => {
  const env = trimToNull(envValue);
  if (env) {
    return env;
  }
  const config = trimToNull(configValue);
  if (config) {
    return config;
  }
  return null;
};

const fetchJson = (targetUrl, timeoutMs = DISCOVERY_TIMEOUT_MS) => new Promise((resolve, reject) => {
  if (typeof targetUrl !== 'string' || !/^https?:\/\//i.test(targetUrl)) {
    reject(new Error(`Invalid URL for discovery: ${targetUrl}`));
    return;
  }

  const transport = targetUrl.startsWith('https://') ? https : http;
  let settled = false;

  const req = transport.get(targetUrl, { headers: { Accept: 'application/json' } }, (res) => {
    const { statusCode } = res;
    const chunks = [];

    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => {
      if (settled) {
        return;
      }
      settled = true;

      if (statusCode && statusCode >= 400) {
        reject(new Error(`Discovery request failed with status ${statusCode}`));
        return;
      }

      const body = Buffer.concat(chunks).toString('utf8');

      try {
        const json = JSON.parse(body);
        resolve(json);
      } catch (error) {
        reject(new Error(`Failed to parse discovery JSON from ${targetUrl}: ${error.message}`));
      }
    });
  });

  req.on('error', (error) => {
    if (!settled) {
      settled = true;
      reject(error);
    }
  });

  req.setTimeout(timeoutMs, () => {
    if (!settled) {
      settled = true;
      req.destroy(new Error(`Discovery request to ${targetUrl} timed out after ${timeoutMs}ms`));
    }
  });
});

const buildWellKnownUrl = (issuer) => {
  if (!issuer) {
    throw new Error('Issuer is required to build discovery URL.');
  }
  const normalizedIssuer = issuer.replace(/\/+$/, '');
  return `${normalizedIssuer}${WELL_KNOWN_PATH}`;
};

const resolveScopes = (oidc) => {
  const scopes = Array.isArray(oidc?.scopes) && oidc.scopes.length > 0
    ? oidc.scopes.filter((scope) => typeof scope === 'string' && scope.trim())
    : DEFAULT_SCOPES;

  // passport-openidconnect automatically prefixes "openid", so avoid duplicates.
  return scopes
    .map((scope) => scope.trim())
    .filter((scope, index, arr) => arr.indexOf(scope) === index)
    .filter((scope) => scope.toLowerCase() !== 'openid');
};

const discoverOidcEndpoints = async (oidcConfig) => {
  const manualEndpoints = {
    authorizationURL: trimToNull(oidcConfig.authorizationURL),
    tokenURL: trimToNull(oidcConfig.tokenURL),
    userInfoURL: trimToNull(oidcConfig.userInfoURL),
  };

  let discovered = null;
  const discoveryUrl = (() => {
    try {
      return buildWellKnownUrl(oidcConfig.issuer);
    } catch (error) {
      return null;
    }
  })();

  const requiresDiscovery = !manualEndpoints.authorizationURL
    || !manualEndpoints.tokenURL
    || !manualEndpoints.userInfoURL;

  if (discoveryUrl && requiresDiscovery) {
    try {
      discovered = await fetchJson(discoveryUrl);
    } catch (error) {
      console.warn(`OIDC discovery failed for ${discoveryUrl}:`, error.message);
    }
  }

  const endpoints = {
    issuer: trimToNull(discovered?.issuer) || trimToNull(oidcConfig.issuer),
    authorizationURL: manualEndpoints.authorizationURL || trimToNull(discovered?.authorization_endpoint),
    tokenURL: manualEndpoints.tokenURL || trimToNull(discovered?.token_endpoint),
    userInfoURL: manualEndpoints.userInfoURL || trimToNull(discovered?.userinfo_endpoint),
  };

  if (!endpoints.authorizationURL || !endpoints.tokenURL) {
    throw new Error('OIDC configuration requires authorizationURL and tokenURL (discovery or manual configuration).');
  }

  return endpoints;
};

const resolveSecurityConfig = async () => {
  const settings = await getSettings();
  const security = settings?.security || {};
  const envAuth = envAuthConfig || {};
  const envOidc = envAuth.oidc || {};
  const configOidc = security.oidc || {};

  const authEnabled = security.authEnabled !== false;
  const authMode = trimToNull(envAuth.authMode) || trimToNull(security.authMode) || 'local';
  const sessionSecret = preferEnv(envAuth.sessionSecret, security.sessionSecret);

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
    issuer: preferEnv(envOidc.issuer, configOidc.issuer),
    authorizationURL: preferEnv(envOidc.authorizationURL, configOidc.authorizationURL),
    tokenURL: preferEnv(envOidc.tokenURL, configOidc.tokenURL),
    userInfoURL: preferEnv(envOidc.userInfoURL, configOidc.userInfoURL),
    clientId: preferEnv(envOidc.clientId, configOidc.clientId),
    clientSecret: preferEnv(envOidc.clientSecret, configOidc.clientSecret),
    callbackUrl: preferEnv(envOidc.callbackUrl, configOidc.callbackUrl),
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

  let endpoints;
  try {
    endpoints = await discoverOidcEndpoints(oidc);
  } catch (error) {
    console.error('Failed to prepare OIDC endpoints:', error);
    return false;
  }

  const scopeList = resolveScopes(oidc);
  const scope = scopeList.length > 0 ? scopeList.join(' ') : undefined;

  const strategyOptions = {
    issuer: endpoints.issuer,
    authorizationURL: endpoints.authorizationURL,
    tokenURL: endpoints.tokenURL,
    clientID: oidc.clientId,
    clientSecret: oidc.clientSecret || undefined,
    callbackURL: oidc.callbackUrl,
    scope,
    skipUserProfile: endpoints.userInfoURL ? false : true,
  };

  if (endpoints.userInfoURL) {
    strategyOptions.userInfoURL = endpoints.userInfoURL;
  }

  passport.use('oidc', new OpenIDConnectStrategy(
    strategyOptions,
    async (issuer, profile, done) => {
      try {
        const profileJson = (profile && profile._json) || {};
        const subject = trimToNull(profile?.id)
          || trimToNull(profileJson.sub)
          || trimToNull(profileJson.user_id);

        if (!subject) {
          throw new Error('OIDC profile did not include a subject identifier.');
        }

        const emailEntry = Array.isArray(profile?.emails)
          ? profile.emails.find((entry) => trimToNull(entry?.value))
          : null;
        const email = trimToNull(emailEntry?.value)
          || trimToNull(profile?.email)
          || trimToNull(profileJson.email);

        const username = trimToNull(profile?.username)
          || trimToNull(profileJson.preferred_username)
          || email
          || subject;

        const displayName = trimToNull(profile?.displayName)
          || trimToNull(profileJson.name)
          || username
          || null;

        const user = await createOidcUser({
          issuer,
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

  console.log(`OIDC strategy configured for issuer ${strategyOptions.issuer}.`);
  return true;
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

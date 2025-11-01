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

const DEFAULT_ADMIN_GROUPS = ['next-admin'];

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
  const mergeArray = (envArr, cfgArr, fallback = []) => {
    if (Array.isArray(envArr) && envArr.length > 0) return envArr;
    if (Array.isArray(cfgArr) && cfgArr.length > 0) return cfgArr;
    return fallback;
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
    adminGroups: mergeArray(envOidc.adminGroups, configOidc.adminGroups, DEFAULT_ADMIN_GROUPS),
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
    // Signature per passport-openidconnect: (issuer, sub, profile, jwtClaims, accessToken, refreshToken, params, done)
    async (issuer, sub, profile, jwtClaims, accessToken, refreshToken, params, done) => {
      try {
        const claims = (jwtClaims && typeof jwtClaims === 'object') ? jwtClaims : ((profile && profile._json) || {});
        const subject = trimToNull(sub)
          || trimToNull(profile?.id)
          || trimToNull(claims.sub)
          || trimToNull(claims.user_id);

        if (!subject) {
          throw new Error('OIDC profile did not include a subject identifier.');
        }

        const emailEntry = Array.isArray(profile?.emails)
          ? profile.emails.find((entry) => trimToNull(entry?.value))
          : null;
        const email = trimToNull(emailEntry?.value)
          || trimToNull(profile?.email)
          || trimToNull(claims.email);

        const username = trimToNull(profile?.username)
          || trimToNull(claims.preferred_username)
          || email
          || subject;

        const displayName = trimToNull(profile?.displayName)
          || trimToNull(claims.name)
          || username
          || null;

        // Derive roles from IdP claims (groups/roles/entitlements, plus common provider formats)
        const collectedGroups = (() => {
          const acc = [];
          const addAll = (arr) => {
            if (Array.isArray(arr)) {
              arr.forEach((g) => {
                if (typeof g === 'string' && g.trim()) acc.push(g.trim());
              });
            }
          };
          const addFromObject = (obj) => {
            if (obj && typeof obj === 'object' && Array.isArray(obj.roles)) {
              obj.roles.forEach((r) => { if (typeof r === 'string' && r.trim()) acc.push(r.trim()); });
            }
          };
          // Common claims
          addAll(claims.groups);
          addAll(claims.entitlements);
          addAll(claims.roles);
          // Keycloak-style
          addFromObject(claims.realm_access);
          if (claims.resource_access && typeof claims.resource_access === 'object') {
            Object.values(claims.resource_access).forEach(addFromObject);
          }
          // If groups provided as a space/comma-separated string
          if (typeof claims.groups === 'string') {
            claims.groups.split(/[\s,]+/).forEach((g) => { if (g && g.trim()) acc.push(g.trim()); });
          }
          return acc;
        })();

        const normalizedSet = new Set(collectedGroups.map((g) => g.toLowerCase()));
        const configuredAdminGroups = Array.isArray(oidc.adminGroups)
          ? oidc.adminGroups.map((g) => (typeof g === 'string' ? g.toLowerCase().trim() : '')).filter(Boolean)
          : DEFAULT_ADMIN_GROUPS.map((g) => g.toLowerCase());
        const matchesConfiguredGroup = configuredAdminGroups.some((g) => normalizedSet.has(g));
        const isSuperUser = claims.is_superuser === true || claims.superuser === true || claims.admin === true;
        const hasAdminIndicator = isSuperUser
          || matchesConfiguredGroup
          || normalizedSet.has('admin')
          || normalizedSet.has('admins')
          || normalizedSet.has('administrator')
          || normalizedSet.has('next-admin'); // project default
        const derivedRoles = hasAdminIndicator ? ['admin'] : ['user'];

        const user = await createOidcUser({
          issuer,
          subject,
          username,
          displayName,
          email,
          roles: derivedRoles,
        });

        // Update basic profile details and roles (keep admin if already present)
        await updateUser(user.id, (u) => ({
          displayName: displayName || user.displayName || null,
          email: email || user.email || null,
          lastLoginAt: new Date().toISOString(),
          roles: (() => {
            const current = Array.isArray(u?.roles) ? u.roles : [];
            const hasAdmin = current.includes('admin');
            if (hasAdmin) return current; // preserve existing admin
            return derivedRoles;
          })(),
        }));

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

const crypto = require('crypto');
const { auth: eocAuth } = require('express-openid-connect');

const { auth: envAuthConfig, public: publicConfig } = require('../config/index');
const { getOrCreateOidcUser, deriveRolesFromClaims } = require('../services/users');
const { fetchUserInfoClaims } = require('../services/oidcService');
const { oidcStore } = require('../utils/sessionStore');
const logger = require('../utils/logger');

/**
 * Derives baseURL from callbackUrl or PUBLIC_URL
 */
const deriveBaseUrl = (oidc) => {
  try {
    if (oidc.callbackUrl && /^https?:\/\//i.test(oidc.callbackUrl)) {
      const u = new URL(oidc.callbackUrl);
      logger.debug({ baseURL: u.origin, source: 'callbackUrl' }, 'Derived baseURL');
      return u.origin;
    } else if (publicConfig?.url) {
      const u = new URL(publicConfig.url);
      logger.debug({ baseURL: u.origin, source: 'PUBLIC_URL' }, 'Derived baseURL');
      return u.origin;
    }
  } catch (_) {
    logger.debug('Failed to derive baseURL');
  }
  return null;
};

/**
 * Determines if OIDC cookies should be secure based on baseURL
 */
const shouldOidcCookieBeSecure = (baseURL) => {
  try {
    if (baseURL) {
      const u = new URL(baseURL);
      return u.protocol === 'https:';
    }
  } catch (_) {}
  return false;
};

/**
 * Resolves OIDC scopes, ensuring 'openid' is always included
 */
const resolveOidcScopes = (oidc) => {
  const scopes = Array.isArray(oidc.scopes) && oidc.scopes.length 
    ? oidc.scopes 
    : ['openid', 'profile', 'email'];
  
  const scopeParam = Array.from(new Set(['openid', ...scopes])).join(' ');
  logger.debug({ scopes, scopeParam }, 'OIDC scopes resolved');
  
  return scopeParam;
};

/**
 * Creates the afterCallback handler for user synchronization
 */
const createAfterCallbackHandler = (oidc, envAuthConfig) => {
  return async (req, res, session) => {
    logger.debug('afterCallback: start');
    
    try {
      const persistIssuer = oidc.issuer;
      const accessToken = session?.access_token;

      const hasOidc = Boolean(req?.oidc);
      logger.debug(
        { 
          hasOidc, 
          accessTokenPresent: Boolean(accessToken), 
          persistIssuer 
        }, 
        'OIDC user login state'
      );

      let claims = {};

      // Prefer already-decoded user claims if available on req.oidc.user
      const hasReqUser = Boolean(req?.oidc?.user && req.oidc.user.sub);
      logger.debug({ hasReqUser }, 'afterCallback: req.oidc.user presence');
      
      if (hasReqUser) {
        claims = req.oidc.user;
        logger.debug('afterCallback: using req.oidc.user');
      }

      // Fetch from userinfo endpoint if access token is available
      if (accessToken && persistIssuer) {
        logger.debug('afterCallback: fetching userinfo via direct HTTP');
        const directClaims = await fetchUserInfoClaims({ 
          issuer: persistIssuer, 
          accessToken, 
          userInfoURL: oidc.userInfoURL 
        });
        
        if (directClaims && directClaims.sub) {
          claims = directClaims;
          logger.debug('afterCallback: direct userinfo fetch succeeded');
        }
      }

      // Fallback to id_token_claims or session.claims
      if ((!claims || !claims.sub) && session?.id_token_claims) {
        logger.debug('afterCallback: falling back to id_token_claims');
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

      // Derive user information from claims
      const email = claims.email || null;
      const emailVerified = claims.email_verified || false;
      const preferredUsername = claims.preferred_username || claims.username || email || sub;
      const displayName = claims.name || preferredUsername || null;
      const roles = deriveRolesFromClaims(claims, envAuthConfig?.oidc?.adminGroups);

      logger.debug(
        { 
          sub, 
          preferredUsername, 
          displayName, 
          email, 
          emailVerified, 
          roles,
        }, 
        'afterCallback: derived user info'
      );

      // Persist user to database
      await getOrCreateOidcUser({
        issuer: persistIssuer,
        sub,
        username: preferredUsername,
        displayName,
        email,
        emailVerified,
        roles,
        requireEmailVerified: envAuthConfig?.oidc?.requireEmailVerified || false,
        autoCreateUsers: envAuthConfig?.oidc?.autoCreateUsers ?? true,
      });
      
      logger.debug('afterCallback: user persisted/synced');
    } catch (e) {
      // If user sync fails, block login only for operational/expected errors
      // (e.g., auto-provision disabled and profile missing).
      if (e && e.isOperational) {
        throw e;
      }
      logger.warn({ err: e }, 'afterCallback user sync failed');
    }
    
    logger.debug('afterCallback: complete');
    return session;
  };
};

/**
 * Configures Express OpenID Connect (OIDC) authentication
 */
const configureOidc = async (app) => {
  try {
    logger.debug('Configuring Express OpenID Connect');
    
    const oidc = (envAuthConfig && envAuthConfig.oidc) || {};
    
    // Resolve configuration
    const scopeParam = resolveOidcScopes(oidc);
    const baseURL = deriveBaseUrl(oidc);
    const sessionSecret = (envAuthConfig && envAuthConfig.sessionSecret)
      || process.env.SESSION_SECRET
      || crypto.randomBytes(32).toString('hex');

    // Check if OIDC should be enabled
    const eocEnabled = Boolean(
      oidc.enabled && 
      oidc.issuer && 
      oidc.clientId && 
      sessionSecret && 
      baseURL
    );
    
    logger.debug(
      { 
        enabled: eocEnabled, 
        issuer: !!oidc.issuer, 
        clientId: !!oidc.clientId, 
        baseURL: !!baseURL 
      }, 
      'EOC enablement check'
    );

    if (!eocEnabled) {
      logger.info(
        'Express OpenID Connect not configured (missing issuer/client/baseURL/secret or disabled)'
      );
      logger.debug({
        enabled: Boolean(oidc.enabled),
        hasIssuer: Boolean(oidc.issuer),
        hasClientId: Boolean(oidc.clientId),
        hasSecret: Boolean(sessionSecret),
        hasBaseURL: Boolean(baseURL),
      }, 'EOC configuration details');
      return;
    }

    // Determine cookie security
    const eocCookieSecure = shouldOidcCookieBeSecure(baseURL);
    logger.debug({ eocCookieSecure }, 'OIDC session cookie security');
    logger.debug('Using shared SQLite session store for OIDC');

    // Configure OIDC middleware
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
      session: {
        store: oidcStore,
        rolling: true,
        cookie: {
          sameSite: 'Lax',
          secure: eocCookieSecure,
          httpOnly: true,
        },
      },
      afterCallback: createAfterCallbackHandler(oidc, envAuthConfig),
    }));

    logger.info('Express OpenID Connect is configured');
    logger.debug('EOC middleware mounted');
  } catch (e) {
    logger.warn({ err: e }, 'Failed to configure Express OpenID Connect');
  }
};

module.exports = { configureOidc };

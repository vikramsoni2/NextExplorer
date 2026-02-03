const { getRequestUser } = require('../services/users');
const { auth } = require('../config/index');
const { ForbiddenError } = require('../errors/AppError');
const logger = require('../utils/logger');

const authMiddleware = async (req, res, next) => {
  const requestPath = req.path || '';
  const apiRoute = requestPath.startsWith('/api');
  const isAuthRoute = requestPath.startsWith('/api/auth');
  // Allow public share access routes (single share with token: /api/share/:token/*)
  // Note: /api/shares/* are management endpoints and require authentication.
  // Important: exclude /api/share/:token/browse/* so browse requests still require
  // an authenticated user and/or a valid guest session.
  const isPublicShareRoute =
    requestPath.startsWith('/api/share/') && !requestPath.includes('/browse/');

  if (!apiRoute) {
    next();
    return;
  }

  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  if (auth.enabled === false) {
    // Inject a synthetic anonymous user for features that require user context
    req.user = {
      id: 'anonymous',
      username: 'anonymous',
      email: 'anonymous@local',
      displayName: 'Anonymous User',
      roles: ['admin'],
    };
    next();
    return;
  }

  // Allow public feature flags endpoint (contains no sensitive data)
  // its needed for plugin registrations
  if (requestPath === '/api/features' || requestPath.startsWith('/api/features')) {
    next();
    return;
  }

  // Allow public branding endpoint (no sensitive data, used on login page)
  if (requestPath === '/api/branding') {
    next();
    return;
  }

  // Allow ONLYOFFICE server callbacks and file fetches (token-guarded in route)
  // Only when ONLYOFFICE integration is enabled
  let isOnlyofficeGuest = false;
  try {
    const { onlyoffice } = require('../config/index');
    if (onlyoffice && onlyoffice.serverUrl) {
      isOnlyofficeGuest =
        requestPath.startsWith('/api/onlyoffice/file') ||
        requestPath.startsWith('/api/onlyoffice/callback');
    }
  } catch (_) {
    /* ignore */
  }

  if (isOnlyofficeGuest) {
    next();
    return;
  }

  // Allow Collabora WOPI endpoints (token-guarded in route)
  // Only when Collabora integration is enabled
  let isCollaboraGuest = false;
  try {
    const { collabora } = require('../config/index');
    if (collabora && collabora.url && collabora.secret) {
      isCollaboraGuest = requestPath.startsWith('/api/collabora/wopi/');
    }
  } catch (_) {
    /* ignore */
  }

  if (isCollaboraGuest) {
    next();
    return;
  }

  // Check for guest session (on all routes)
  const guestSessionId = req.headers['x-guest-session'] || req.cookies?.guestSession;
  if (guestSessionId) {
    logger.debug(
      {
        source: req.headers['x-guest-session'] ? 'header' : 'cookie',
        sessionId: guestSessionId,
        path: requestPath,
        cookies: Object.keys(req.cookies || {}),
      },
      'Guest session found'
    );

    try {
      const {
        getGuestSession,
        isGuestSessionValid,
        updateGuestSessionActivity,
      } = require('../services/guestSessionService');
      if (await isGuestSessionValid(guestSessionId)) {
        const session = await getGuestSession(guestSessionId);
        req.guestSession = session;
        // Update activity timestamp
        await updateGuestSessionActivity(guestSessionId);

        logger.debug(
          {
            sessionId: guestSessionId,
            shareId: session.shareId,
            path: requestPath,
          },
          'Guest session validated'
        );
      } else {
        logger.debug({ sessionId: guestSessionId }, 'Guest session invalid or expired');
      }
    } catch (err) {
      logger.debug({ err }, 'Guest session validation failed');
    }
  } else if (requestPath.startsWith('/api/preview') || requestPath.startsWith('/api/thumbnails')) {
    logger.debug(
      {
        path: requestPath,
        hasHeader: !!req.headers['x-guest-session'],
        hasCookie: !!req.cookies?.guestSession,
        cookies: Object.keys(req.cookies || {}),
      },
      'No guest session for preview/thumbnail request'
    );
  }

  if (isAuthRoute) {
    next();
    return;
  }

  // Accept either EOC session or local session
  const isEocAuthenticated = Boolean(
    req.oidc && typeof req.oidc.isAuthenticated === 'function' && req.oidc.isAuthenticated()
  );
  const hasLocalSession = Boolean(req.session && req.session.localUserId);
  if (isEocAuthenticated || hasLocalSession) {
    try {
      const user = await getRequestUser(req);
      if (user) req.user = user;
      if (isEocAuthenticated && !user && (auth?.oidc?.autoCreateUsers ?? true) === false) {
        // Allow guest/public access without an app user profile.
        if (isPublicShareRoute || req.guestSession) {
          next();
          return;
        }
        throw new ForbiddenError('Profile does not exist.');
      }
    } catch (err) {
      if (err && err.isOperational) {
        next(err);
        return;
      }
      /* ignore */
    }

    // If the user is authenticated, prefer user access over any guest session.
    // This prevents stale guest sessions from blocking access to volumes/personal paths.
    if (req.user && req.guestSession) {
      delete req.guestSession;
    }

    next();
    return;
  }

  // Public share routes should be accessible without authentication, but we still
  // tried to attach an authenticated user above (if present) to support
  // user-specific shares opened via share links.
  if (isPublicShareRoute) {
    next();
    return;
  }

  // Allow access if valid guest session exists (for share paths on browse, files, etc.)
  if (req.guestSession) {
    logger.debug('Allowing request with guest session');
    next();
    return;
  }

  res.status(401).json({ error: 'Authentication required.' });
};

module.exports = authMiddleware;

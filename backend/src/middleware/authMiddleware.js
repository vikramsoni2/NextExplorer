const { getRequestUser } = require('../services/users');
const { auth } = require('../config/index');

const authMiddleware = async (req, res, next) => {
  const requestPath = req.path || '';
  const apiRoute = requestPath.startsWith('/api');
  const isAuthRoute = requestPath.startsWith('/api/auth');
  // Allow public share access routes (single share with token: /api/share/:token/*)
  // Note: /api/shares/* are management endpoints and require authentication.
  // Important: exclude /api/share/:token/browse/* so browse requests still require
  // an authenticated user and/or a valid guest session.
  const isPublicShareRoute = requestPath.startsWith('/api/share/')
    && !requestPath.includes('/browse/');

  if (!apiRoute) {
    next();
    return;
  }

  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  if (auth.enabled===false) {
    // Inject a synthetic anonymous user for features that require user context
    req.user = { 
      id: 'anonymous', 
      username: 'anonymous', 
      email:'anonymous@local',  
      displayName: 'Anonymous User', 
      roles:['admin']
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

  // Allow ONLYOFFICE server callbacks and file fetches (token-guarded in route)
  // Only when ONLYOFFICE integration is enabled
  let isOnlyofficeGuest = false;
  try {
    const { onlyoffice } = require('../config/index');
    if (onlyoffice && onlyoffice.serverUrl) {
      isOnlyofficeGuest = requestPath.startsWith('/api/onlyoffice/file')
        || requestPath.startsWith('/api/onlyoffice/callback');
    }
  } catch (_) { /* ignore */ }

  if (isOnlyofficeGuest) {
    next();
    return;
  }

  // Check for guest session (on all routes)
  const guestSessionId = req.headers['x-guest-session'] || req.cookies?.guestSession;
  if (guestSessionId) {
    console.log('[DEBUG] Guest session found:', {
      source: req.headers['x-guest-session'] ? 'header' : 'cookie',
      sessionId: guestSessionId,
      path: requestPath,
      cookies: Object.keys(req.cookies || {}),
    });

    try {
      const { getGuestSession, isGuestSessionValid, updateGuestSessionActivity } = require('../services/guestSessionService');
      if (await isGuestSessionValid(guestSessionId)) {
        const session = await getGuestSession(guestSessionId);
        req.guestSession = session;
        // Update activity timestamp
        await updateGuestSessionActivity(guestSessionId);

        console.log('[DEBUG] Guest session validated:', {
          sessionId: guestSessionId,
          shareId: session.shareId,
          path: requestPath
        });
      } else {
        console.log('[DEBUG] Guest session invalid or expired:', guestSessionId);
      }
    } catch (err) {
      console.error('[DEBUG] Guest session validation failed:', err);
    }
  } else if (requestPath.startsWith('/api/preview') || requestPath.startsWith('/api/thumbnails')) {
    console.log('[DEBUG] No guest session for preview/thumbnail request:', {
      path: requestPath,
      hasHeader: !!req.headers['x-guest-session'],
      hasCookie: !!req.cookies?.guestSession,
      cookies: Object.keys(req.cookies || {}),
    });
  }

  if (isAuthRoute) {
    next();
    return;
  }

  // Accept either EOC session or local session
  const isEocAuthenticated = Boolean(req.oidc && typeof req.oidc.isAuthenticated === 'function' && req.oidc.isAuthenticated());
  const hasLocalSession = Boolean(req.session && req.session.localUserId);
  if (isEocAuthenticated || hasLocalSession) {
    try {
      const user = await getRequestUser(req);
      if (user) req.user = user;
    } catch (_) { /* ignore */ }

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
    console.log('[DEBUG] Allowing request with guest session');
    next();
    return;
  }

  res.status(401).json({ error: 'Authentication required.' });
};

module.exports = authMiddleware;

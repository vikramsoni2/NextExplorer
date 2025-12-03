const { getRequestUser } = require('../services/users');
const { auth } = require('../config/index');

const authMiddleware = async (req, res, next) => {
  const requestPath = req.path || '';
  const apiRoute = requestPath.startsWith('/api');
  const isAuthRoute = requestPath.startsWith('/api/auth');

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
          shareToken: session.shareToken,
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

  // Allow public share access routes (single share with token: /api/share/:token/*)
  // Note: /api/shares/* are management endpoints and require authentication
  // Important: exclude /api/share/:token/browse/* so that browse requests
  // still attach authenticated users and/or guest sessions via the logic below.
  const isPublicShareRoute = requestPath.startsWith('/api/share/')
    && !requestPath.includes('/browse/');
  if (isPublicShareRoute) {
    next();
    return;
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

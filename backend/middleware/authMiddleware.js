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

  res.status(401).json({ error: 'Authentication required.' });
};

module.exports = authMiddleware;

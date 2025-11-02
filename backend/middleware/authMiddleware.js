const { getSettings } = require('../services/appConfigService');
const { getRequestUser } = require('../services/users');

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

  const settings = await getSettings();
  const authEnabled = settings?.security?.authEnabled !== false;

  if (!authEnabled) {
    // Public mode: allow all API requests without auth
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

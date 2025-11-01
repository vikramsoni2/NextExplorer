const {
  isPasswordSet,
  isSessionTokenValid,
  getUserIdForToken,
  sanitizeUserForClient,
} = require('../services/authService');
const { extractToken } = require('../utils/auth');
const { getSettings } = require('../services/appConfigService');
const { findById } = require('../services/userStore');

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

  if (!isPasswordSet()) {
    if (isAuthRoute) {
      next();
      return;
    }

    res.status(503).json({ error: 'Authentication setup required.' });
    return;
  }

  if (isAuthRoute) {
    next();
    return;
  }

  if (typeof req.isAuthenticated === 'function' && req.isAuthenticated()) {
    next();
    return;
  }

  const token = extractToken(req);

  if (token && isSessionTokenValid(token)) {
    const userId = getUserIdForToken(token);
    if (userId) {
      const user = await findById(userId);
      if (user) {
        req.sessionToken = token;
        if (!req.user) {
          req.user = sanitizeUserForClient(user);
        }
        next();
        return;
      }
    }
  }

  res.status(401).json({ error: 'Authentication required' });
};

module.exports = authMiddleware;

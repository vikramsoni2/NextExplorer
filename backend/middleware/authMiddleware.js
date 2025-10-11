const { isPasswordSet, isSessionTokenValid } = require('../services/authService');
const { extractToken } = require('../utils/auth');
const { getSettings } = require('../services/appConfigService');

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

    res.status(503).json({ error: 'Password setup required.' });
    return;
  }

  if (isAuthRoute) {
    next();
    return;
  }

  const token = extractToken(req);

  if (!token || !isSessionTokenValid(token)) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  req.sessionToken = token;
  next();
};

module.exports = authMiddleware;

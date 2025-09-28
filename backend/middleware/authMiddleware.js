const { isPasswordSet, isSessionTokenValid } = require('../services/authService');
const { extractToken } = require('../utils/auth');

const authMiddleware = (req, res, next) => {

  const apiRoute = req.path.startsWith('/api');
  const isAuthRoute = req.path.startsWith('/api/auth');

  if (req.method === 'OPTIONS') {
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

  if (apiRoute &&  (!token || !isSessionTokenValid(token))) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  req.sessionToken = token;
  next();
};

module.exports = authMiddleware;

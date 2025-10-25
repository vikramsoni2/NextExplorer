const express = require('express');

const {
  createInitialUser,
  createSessionToken,
  invalidateSessionToken,
  isSessionTokenValid,
  getUserIdForToken,
  getStatus,
  sanitizeUserForClient,
} = require('../services/authService');
const { extractToken } = require('../utils/auth');
const {
  passport: passportInstance,
  resolveSecurityConfig,
} = require('../services/passport');
const { findById } = require('../services/userStore');

const router = express.Router();

const respondWithUser = async (req, res) => {
  const token = extractToken(req);
  let user = null;

  if (req.user) {
    user = req.user;
  } else if (token && isSessionTokenValid(token)) {
    const userId = getUserIdForToken(token);
    if (userId) {
      const storedUser = await findById(userId);
      if (storedUser) {
        user = sanitizeUserForClient(storedUser);
      }
    }
  }

  res.json({
    user,
  });
};

router.get('/status', async (req, res) => {
  const token = extractToken(req);
  const status = await getStatus();
  const security = await resolveSecurityConfig();
  const authenticatedViaSession = typeof req.isAuthenticated === 'function' && req.isAuthenticated();
  const authenticatedViaToken = Boolean(token && isSessionTokenValid(token));

  let user = null;
  if (authenticatedViaSession && req.user) {
    user = req.user;
  } else if (authenticatedViaToken) {
    const userId = getUserIdForToken(token);
    if (userId) {
      const storedUser = await findById(userId);
      if (storedUser) {
        user = sanitizeUserForClient(storedUser);
      }
    }
  }

  res.json({
    ...status,
    authEnabled: security.authEnabled !== false,
    authMode: security.authMode,
    authenticated: authenticatedViaSession || authenticatedViaToken,
    user,
    oidc: {
      enabled: security.oidc?.enabled || false,
      issuer: security.oidc?.issuer || null,
      scopes: security.oidc?.scopes || [],
    },
  });
});

router.post('/setup', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const user = await createInitialUser({ username, password });

    req.login(user, (loginError) => {
      if (loginError) {
        next(loginError);
        return;
      }

      const token = createSessionToken(user.id);
      res.status(201).json({ user, token });
    });
  } catch (error) {
    if (error?.code === 'ALREADY_CONFIGURED') {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.post('/login', (req, res, next) => {
  passportInstance.authenticate('local', (authError, user, info) => {
    if (authError) {
      next(authError);
      return;
    }

    if (!user) {
      res.status(401).json({ error: info?.message || 'Invalid credentials.' });
      return;
    }

    req.login(user, (loginError) => {
      if (loginError) {
        next(loginError);
        return;
      }

      const token = createSessionToken(user.id);
      res.json({
        user,
        token,
      });
    });
  })(req, res, next);
});

router.post('/logout', (req, res, next) => {
  const token = extractToken(req);

  if (token) {
    invalidateSessionToken(token);
  }

  const finalize = () => {
    res.status(204).end();
  };

  if (typeof req.logout === 'function') {
    req.logout((logoutError) => {
      if (logoutError) {
        next(logoutError);
        return;
      }
      if (req.session) {
        req.session.destroy(() => finalize());
      } else {
        finalize();
      }
    });
    return;
  }

  finalize();
});

router.get('/me', async (req, res) => {
  await respondWithUser(req, res);
});

router.post('/token', async (req, res) => {
  let userId = null;

  if (typeof req.isAuthenticated === 'function' && req.isAuthenticated() && req.user?.id) {
    userId = req.user.id;
  } else {
    const token = extractToken(req);
    if (token && isSessionTokenValid(token)) {
      userId = getUserIdForToken(token);
    }
  }

  if (!userId) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const token = createSessionToken(userId);
  res.json({ token });
});

const getOidcStrategy = () => {
  try {
    return passportInstance._strategy('oidc');
  } catch (error) {
    return null;
  }
};

router.get('/oidc/login', async (req, res, next) => {
  const strategy = getOidcStrategy();
  if (!strategy) {
    res.status(404).json({ error: 'OIDC is not configured.' });
    return;
  }

  const redirect = typeof req.query?.redirect === 'string' ? req.query.redirect : null;
  if (redirect && req.session) {
    req.session.returnTo = redirect;
  }

  passportInstance.authenticate('oidc')(req, res, next);
});

router.get('/oidc/callback', (req, res, next) => {
  const strategy = getOidcStrategy();
  if (!strategy) {
    res.status(404).json({ error: 'OIDC is not configured.' });
    return;
  }

  passportInstance.authenticate('oidc', (authError, user) => {
    if (authError) {
      next(authError);
      return;
    }

    if (!user) {
      res.redirect('/auth/login?error=oidc_failed');
      return;
    }

    req.login(user, (loginError) => {
      if (loginError) {
        next(loginError);
        return;
      }

      let redirectTarget = '/';
      if (req.session?.returnTo) {
        redirectTarget = req.session.returnTo;
        delete req.session.returnTo;
      }
      const isAbsolute = /^https?:\/\//i.test(redirectTarget);
      if (isAbsolute) {
        res.redirect(redirectTarget);
        return;
      }
      res.redirect(redirectTarget || '/');
    });
  })(req, res, next);
});

module.exports = router;

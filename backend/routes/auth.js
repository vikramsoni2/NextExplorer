const express = require('express');
const crypto = require('crypto');
const { auth } = require('../config/index');

const {
  countUsers,
  createLocalUser,
  attemptLocalLogin,
  changeLocalPassword,
  addLocalPassword,
  getUserAuthMethods,
  getRequestUser,
} = require('../services/users');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const setupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

const respondWithUser = async (req, res) => {
  const user = await getRequestUser(req);
  res.json({ user });
};

router.get('/status', async (req, res) => {
  const oidcEnv = (auth && auth.oidc) || {};
  const authMode = auth.mode || 'both';
  // Skip setup requirement if AUTH_MODE is 'oidc' only
  const requiresSetup = auth.enabled && authMode !== 'oidc' ? (await countUsers()) === 0 : false;
  const isEoc = Boolean(req.oidc && typeof req.oidc.isAuthenticated === 'function' && req.oidc.isAuthenticated());
  const hasLocal = Boolean(req.session && req.session.localUserId);
  const user = await getRequestUser(req);

  // Determine available strategies based on auth.mode
  const strategies = {
    local: authMode === 'local' || authMode === 'both',
    oidc: (authMode === 'oidc' || authMode === 'both') && Boolean(oidcEnv.enabled),
  };

  res.json({
    requiresSetup,
    strategies,
    authEnabled: auth.enabled,
    authMode,
    authenticated: auth.enabled ? Boolean(isEoc || hasLocal) : true,
    user: user || null,
    oidc: {
      enabled: Boolean(oidcEnv.enabled),
      issuer: oidcEnv.issuer || null,
      scopes: oidcEnv.scopes || [],
    },
  });
});

// Initial admin setup
router.post('/setup', setupLimiter, async (req, res, next) => {
  try {
    if ((await countUsers()) > 0) {
      res.status(400).json({ error: 'Already configured.' });
      return;
    }
    const { email, password, username } = req.body || {};
    const user = await createLocalUser({
      email,
      password,
      username: username || email?.split('@')[0],
      displayName: username || email?.split('@')[0],
      roles: ['admin']
    });
    if (req.session) req.session.localUserId = user.id;
    res.status(201).json({ user });
  } catch (e) {
    next(e);
  }
});

// Local login with email + password
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password, username } = req.body || {};
    // Support both email and username (backward compatibility)
    const emailOrUsername = email || username;

    let user = null;
    try {
      user = await attemptLocalLogin({ email: emailOrUsername, password });
    } catch (e) {
      if (e?.status === 423) {
        res.status(423).json({ error: e.message, until: e.until });
        return;
      }
      throw e;
    }
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }
    if (req.session) req.session.localUserId = user.id;
    res.json({ user });
  } catch (e) {
    next(e);
  }
});

// Change password (for users with password auth)
router.post('/password', passwordLimiter, async (req, res, next) => {
  try {
    const me = await getRequestUser(req);
    if (!me) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const { currentPassword, newPassword } = req.body || {};
    await changeLocalPassword({ userId: me.id, currentPassword, newPassword });
    res.status(204).end();
  } catch (e) {
    const status = typeof e?.status === 'number' ? e.status : 400;
    res.status(status).json({ error: e?.message || 'Failed to change password.' });
  }
});

// Add password authentication to current user (for OIDC-only users)
router.post('/password/add', passwordLimiter, async (req, res, next) => {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const { password } = req.body || {};
    await addLocalPassword({ userId: user.id, password });

    res.json({ message: 'Password authentication added successfully.' });
  } catch (e) {
    const status = typeof e?.status === 'number' ? e.status : 400;
    res.status(status).json({ error: e?.message || 'Failed to add password authentication.' });
  }
});

// Get available auth methods for current user
router.get('/methods', async (req, res, next) => {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const methods = await getUserAuthMethods(user.id);

    res.json({
      methods: methods.map(m => ({
        id: m.id,
        type: m.method_type,
        provider: m.provider_name || (m.method_type === 'local_password' ? 'Password' : 'Unknown'),
        lastUsedAt: m.last_used_at,
        createdAt: m.created_at,
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/logout', (req, res) => {
  // Clear local app session if present (local auth)
  if (req.session) {
    try { req.session.destroy(() => {}); } catch (_) { /* ignore */ }
  }
  // Clear the EOC appSession cookie (local OIDC session) without redirecting
  try {
    // Attempt to clear both secure and non-secure variants to be robust.
    res.clearCookie('appSession', { path: '/', sameSite: 'Lax', secure: true, httpOnly: true });
  } catch (_) { /* ignore */ }
  try {
    res.clearCookie('appSession', { path: '/', sameSite: 'Lax', secure: false, httpOnly: true });
  } catch (_) { /* ignore */ }
  // For IdP/federated logout, the UI navigates to GET /logout separately.
  res.status(204).end();
});

router.get('/me', async (req, res) => {
  await respondWithUser(req, res);
});

router.post('/token', (req, res) => res.status(400).json({ error: 'Token minting is disabled.' }));

router.get('/oidc/login', async (req, res, next) => {
  try {
    if (res.oidc && typeof res.oidc.login === 'function') {
      const redirect = typeof req.query?.redirect === 'string' ? req.query.redirect : '/';
      await res.oidc.login({ returnTo: redirect });
      return;
    }
  } catch (e) {
    // ignore
  }
  res.status(404).json({ error: 'OIDC is not configured.' });
});


module.exports = router;

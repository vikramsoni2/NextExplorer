const express = require('express');
const { auth: envAuthConfig } = require('../config/index');
const {
  countLocalUsers,
  createLocal,
  attemptLocalLogin,
  changeLocalPassword,
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
  const oidcEnv = (envAuthConfig && envAuthConfig.oidc) || {};
  const requiresSetup = (await countLocalUsers()) === 0;
  const isEoc = Boolean(req.oidc && typeof req.oidc.isAuthenticated === 'function' && req.oidc.isAuthenticated());
  const hasLocal = Boolean(req.session && req.session.localUserId);
  const user = await getRequestUser(req);
  res.json({
    requiresSetup,
    strategies: { local: true, oidc: Boolean(oidcEnv.enabled) },
    authEnabled: true,
    authMode: 'both',
    authenticated: Boolean(isEoc || hasLocal),
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
    if ((await countLocalUsers()) > 0) {
      res.status(400).json({ error: 'Already configured.' });
      return;
    }
    const { username, password } = req.body || {};
    const user = await createLocal({ username, password, roles: ['admin'] });
    if (req.session) req.session.localUserId = user.id;
    res.status(201).json({ user });
  } catch (e) {
    next(e);
  }
});

// Local login
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    let user = null;
    try {
      user = await attemptLocalLogin({ username, password });
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

// Change password (local users only)
router.post('/password', passwordLimiter, async (req, res, next) => {
  try {
    const me = await getRequestUser(req);
    if (!me) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (me.provider !== 'local') {
      res.status(400).json({ error: 'Password change is only allowed for local users.' });
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

router.post('/logout', (req, res) => {
  // Clear local app session if present (local auth)
  if (req.session) {
    try { req.session.destroy(() => {}); } catch (_) { /* ignore */ }
  }
  // Clear the EOC appSession cookie (local OIDC session) without redirecting
  try {
    res.clearCookie('appSession', {
      path: '/',
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
    });
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

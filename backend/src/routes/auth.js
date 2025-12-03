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
const asyncHandler = require('../utils/asyncHandler');
const {
  ValidationError,
  UnauthorizedError,
  RateLimitError,
  NotFoundError
} = require('../errors/AppError');

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
router.post('/setup', setupLimiter, asyncHandler(async (req, res) => {
  if ((await countUsers()) > 0) {
    throw new ValidationError('Aoolication Already configured. Skkipping Setup.');
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

  // Clear guest session cookie when user sets up account
  res.clearCookie('guestSession', { path: '/api' });

  res.status(201).json({ user });
}));

// Local login with email + password
router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { email, password, username } = req.body || {};
  // Support both email and username (backward compatibility)
  const emailOrUsername = email || username;

  let user = null;
  try {
    user = await attemptLocalLogin({ email: emailOrUsername, password });
  } catch (e) {
    if (e?.status === 423) {
      throw new RateLimitError(e.message, e.until);
    }
    throw e;
  }
  if (!user) {
    throw new UnauthorizedError('Invalid credentials.');
  }
  if (req.session) req.session.localUserId = user.id;

  // Clear guest session cookie when user logs in
  res.clearCookie('guestSession', { path: '/api' });

  res.json({ user });
}));

// Change password (for users with password auth)
router.post('/password', passwordLimiter, asyncHandler(async (req, res) => {
  const me = await getRequestUser(req);
  if (!me) {
    throw new UnauthorizedError('Authentication required.');
  }

  const { currentPassword, newPassword } = req.body || {};
  await changeLocalPassword({ userId: me.id, currentPassword, newPassword });
  res.status(204).end();
}));

// Add password authentication to current user (for OIDC-only users)
router.post('/password/add', passwordLimiter, asyncHandler(async (req, res) => {
  const user = await getRequestUser(req);
  if (!user) {
    throw new UnauthorizedError('Authentication required.');
  }

  const { password } = req.body || {};
  await addLocalPassword({ userId: user.id, password });

  res.json({ message: 'Password authentication added successfully.' });
}));

// Get available auth methods for current user
router.get('/methods', asyncHandler(async (req, res) => {
  const user = await getRequestUser(req);
  if (!user) {
    throw new UnauthorizedError('Authentication required.');
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
}));

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

router.get('/oidc/login', asyncHandler(async (req, res) => {
  try {
    if (res.oidc && typeof res.oidc.login === 'function') {
      const redirect = typeof req.query?.redirect === 'string' ? req.query.redirect : '/';
      await res.oidc.login({ returnTo: redirect });
      return;
    }
  } catch (e) {
    // ignore
  }
  throw new NotFoundError('OIDC is not configured.');
}));


module.exports = router;

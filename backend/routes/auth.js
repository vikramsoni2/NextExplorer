const express = require('express');

const {
  isPasswordSet,
  setPassword,
  verifyPassword,
  createSessionToken,
  invalidateSessionToken,
  isSessionTokenValid,
  getStatus,
} = require('../services/authService');
const { extractToken } = require('../utils/auth');

const router = express.Router();
const { getSettings } = require('../services/appConfigService');

router.get('/status', async (req, res) => {
  const token = extractToken(req);
  const status = getStatus();
  const authenticated = Boolean(token && isSessionTokenValid(token));
  const settings = await getSettings();
  const authEnabled = settings?.security?.authEnabled !== false;

  res.json({
    ...status,
    authenticated,
    authEnabled,
  });
});

router.post('/setup', async (req, res) => {
  if (isPasswordSet()) {
    res.status(400).json({ error: 'Password has already been configured.' });
    return;
  }

  const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    return;
  }

  await setPassword(password);
  const token = createSessionToken();

  res.status(201).json({ token });
});

router.post('/login', async (req, res) => {
  if (!isPasswordSet()) {
    res.status(400).json({ error: 'Password setup is required before login.' });
    return;
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!password) {
    res.status(400).json({ error: 'Password is required.' });
    return;
  }

  const isValid = await verifyPassword(password);

  if (!isValid) {
    res.status(401).json({ error: 'Invalid password.' });
    return;
  }

  const token = createSessionToken();
  res.json({ token });
});

router.post('/logout', (req, res) => {
  const token = extractToken(req);
  if (token) {
    invalidateSessionToken(token);
  }

  res.status(204).end();
});

module.exports = router;

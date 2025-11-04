const express = require('express');

const { getSettings, setSettings } = require('../services/appConfigService');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/settings -> returns current settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    logger.error({ err: error }, 'Failed to load settings');
    res.status(500).json({ error: 'Failed to load settings.' });
  }
});

// PATCH /api/settings -> merge partial settings, validate and save
router.patch('/settings', async (req, res) => {
  try {
    const payload = req.body || {};
    const nextPartial = {};

    if (payload.thumbnails && typeof payload.thumbnails === 'object') {
      const t = payload.thumbnails;
      nextPartial.thumbnails = {
        ...(t.enabled != null ? { enabled: Boolean(t.enabled) } : {}),
        ...(Number.isFinite(t.size) ? { size: Math.max(64, Math.min(1024, Math.floor(t.size))) } : {}),
        ...(Number.isFinite(t.quality) ? { quality: Math.max(1, Math.min(100, Math.floor(t.quality))) } : {}),
      };
    }

    if (payload.security && typeof payload.security === 'object') {
      const s = payload.security;
      nextPartial.security = {
        ...(s.authEnabled != null ? { authEnabled: Boolean(s.authEnabled) } : {}),
        ...(typeof s.authMode === 'string' ? { authMode: s.authMode } : {}),
        ...(typeof s.sessionSecret === 'string' && s.sessionSecret.trim() ? { sessionSecret: s.sessionSecret.trim() } : {}),
      };

      if (s.oidc && typeof s.oidc === 'object') {
        nextPartial.security.oidc = {
          ...(s.oidc.enabled != null ? { enabled: Boolean(s.oidc.enabled) } : {}),
          ...(typeof s.oidc.issuer === 'string' && s.oidc.issuer.trim() ? { issuer: s.oidc.issuer.trim() } : {}),
          ...(typeof s.oidc.authorizationURL === 'string' && s.oidc.authorizationURL.trim() ? { authorizationURL: s.oidc.authorizationURL.trim() } : {}),
          ...(typeof s.oidc.tokenURL === 'string' && s.oidc.tokenURL.trim() ? { tokenURL: s.oidc.tokenURL.trim() } : {}),
          ...(typeof s.oidc.userInfoURL === 'string' && s.oidc.userInfoURL.trim() ? { userInfoURL: s.oidc.userInfoURL.trim() } : {}),
          ...(typeof s.oidc.clientId === 'string' && s.oidc.clientId.trim() ? { clientId: s.oidc.clientId.trim() } : {}),
          ...(typeof s.oidc.clientSecret === 'string' && s.oidc.clientSecret.trim() ? { clientSecret: s.oidc.clientSecret.trim() } : {}),
          ...(typeof s.oidc.callbackUrl === 'string' && s.oidc.callbackUrl.trim() ? { callbackUrl: s.oidc.callbackUrl.trim() } : {}),
          ...(Array.isArray(s.oidc.scopes) ? { scopes: s.oidc.scopes } : {}),
        };
      }
    }

    if (payload.access && typeof payload.access === 'object') {
      const a = payload.access;
      if (Array.isArray(a.rules)) {
        nextPartial.access = { rules: a.rules };
      }
    }

    const updated = await setSettings(nextPartial);
    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Failed to update settings');
    res.status(400).json({ error: 'Failed to update settings.' });
  }
});

module.exports = router;

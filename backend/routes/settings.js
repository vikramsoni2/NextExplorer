const express = require('express');

const { getSettings, setSettings } = require('../services/appConfigService');

const router = express.Router();

// GET /api/settings -> returns current settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Failed to load settings:', error);
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
      };
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
    console.error('Failed to update settings:', error);
    res.status(400).json({ error: 'Failed to update settings.' });
  }
});

module.exports = router;


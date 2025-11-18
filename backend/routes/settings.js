const express = require('express');
const { getSettings, setSettings } = require('../services/settingsService');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

/**
 * GET /api/settings
 * Returns current user-configurable settings
 */
router.get('/settings', asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json(settings);
}));

/**
 * PATCH /api/settings
 * Update settings with partial data
 * Validates and merges with existing settings
 */
router.patch('/settings', asyncHandler(async (req, res) => {
  const payload = req.body || {};

  // Build partial update object
  const updates = {};

  // Thumbnails settings
  if (payload.thumbnails && typeof payload.thumbnails === 'object') {
    updates.thumbnails = {};
    if (payload.thumbnails.enabled != null) {
      updates.thumbnails.enabled = Boolean(payload.thumbnails.enabled);
    }
    if (Number.isFinite(payload.thumbnails.size)) {
      updates.thumbnails.size = payload.thumbnails.size;
    }
    if (Number.isFinite(payload.thumbnails.quality)) {
      updates.thumbnails.quality = payload.thumbnails.quality;
    }
  }

  // Access control rules
  if (payload.access && typeof payload.access === 'object') {
    if (Array.isArray(payload.access.rules)) {
      updates.access = { rules: payload.access.rules };
    }
  }

  const updated = await setSettings(updates);
  res.json(updated);
}));

module.exports = router;
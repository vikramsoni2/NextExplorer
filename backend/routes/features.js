const express = require('express');
const { onlyoffice } = require('../config/index');

const router = express.Router();

// GET /api/features -> returns enabled/disabled feature flags derived from env
router.get('/features', async (_req, res) => {
  try {
    const payload = {
      onlyoffice: {
        enabled: Boolean(onlyoffice && onlyoffice.serverUrl),
        extensions: Array.isArray(onlyoffice?.extensions) ? onlyoffice.extensions : [],
      },
    };
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load feature flags.' });
  }
});

module.exports = router;

const express = require('express');
const { onlyoffice, editor, features } = require('../config/index');
const { getDb } = require('../services/db');

const router = express.Router();

// GET /api/features -> returns enabled/disabled feature flags derived from env
router.get('/features', async (_req, res) => {
  try {
    const payload = {
      onlyoffice: {
        enabled: Boolean(onlyoffice && onlyoffice.serverUrl),
        extensions: Array.isArray(onlyoffice?.extensions) ? onlyoffice.extensions : [],
      },
      editor: {
        extensions: Array.isArray(editor?.extensions) ? editor.extensions : [],
      },
      volumeUsage: {
        enabled: Boolean(features?.volumeUsage),
      },
      announcements: [],
    };

    // Read one-time announcements from DB meta
    try {
      const db = await getDb();
      // Ensure meta table exists and read keys
      const getMeta = db.prepare('SELECT value FROM meta WHERE key = ?').pluck();
      const raw = getMeta.get('notice_migration_v3');
      if (raw) {
        try {
          const notice = JSON.parse(raw);
          if (notice && notice.pending) {
            payload.announcements.push({
              id: 'v3-user-migration',
              level: 'info',
              title: 'We\'ve updated how you sign in',
              message: 'You now need to use your new email-style username. To sign in, add @example.local to your username (for example: username@example.local). Your password stays the same.',
              once: true,
            });
          }
        } catch (_) {
          // ignore parse issues
        }
      }
    } catch (_) {
      // DB may not be initialized; announcements are optional
    }
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load feature flags.' });
  }
});

module.exports = router;

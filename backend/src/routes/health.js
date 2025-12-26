const express = require('express');
const router = express.Router();

// Basic liveness probe - process is up and serving HTTP
router.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Basic readiness probe - app has started successfully
// If you add dependencies (DB, cache, etc.), check them here.
router.get('/readyz', (req, res) => {
  res.status(200).json({ status: 'ready' });
});

module.exports = router;

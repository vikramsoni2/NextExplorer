const express = require('express');
const { onlyoffice, editor, features } = require('../config/index');
const packageJson = require('../../package.json');

const router = express.Router();

// GET /api/features -> returns enabled/disabled feature flags derived from env
router.get('/features', (_req, res) => {
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
    personal: {
      enabled: Boolean(features?.personalFolders),
    },
    version: {
      app: packageJson.version || '1.0.0',
      gitCommit: process.env.GIT_COMMIT || '',
      gitBranch: process.env.GIT_BRANCH || '',
      repoUrl: process.env.REPO_URL || '',
    },
  };

  res.json(payload);
});

module.exports = router;

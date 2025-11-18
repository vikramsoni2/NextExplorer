const express = require('express');
const fs = require('fs/promises');

const { directories, excludedFiles } = require('../config/index');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/volumes', asyncHandler(async (req, res) => {
  const entries = await fs.readdir(directories.volume, { withFileTypes: true });

  const volumeData = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !excludedFiles.includes(name))
    .map((name) => ({
      name,
      path: name,
      kind: 'volume',
    }));

  res.json(volumeData);
}));

module.exports = router;

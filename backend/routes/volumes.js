const express = require('express');
const fs = require('fs/promises');

const { directories, excludedFiles } = require('../config/index');

const router = express.Router();

router.get('/volumes', async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Failed to fetch volumes:', error);
    res.status(500).json({ error: 'An error occurred while fetching the volumes.' });
  }
});

module.exports = router;

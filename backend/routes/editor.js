const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const { normalizeRelativePath, resolveVolumePath } = require('../utils/pathUtils');
const { ensureDir } = require('../utils/fsUtils');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/editor', async (req, res) => {
  try {
    const { path: relative = '' } = req.body || {};
    if (typeof relative !== 'string' || !relative) {
      return res.status(400).json({ error: 'A valid file path is required.' });
    }

    const relativePath = normalizeRelativePath(relative);
    const absolutePath = resolveVolumePath(relativePath);
    const stats = await fs.stat(absolutePath);

    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Cannot open a directory in the editor.' });
    }

    const data = await fs.readFile(absolutePath, { encoding: 'utf-8' });
    res.send({ content: data });
  } catch (error) {
    logger.error({ err: error }, 'Error reading the file');
    res.status(500).json({ error: 'Failed to read file.' });
  }
});

router.put('/editor', async (req, res) => {
  try {
    const { path: relative = '', content = '' } = req.body || {};
    if (typeof relative !== 'string' || !relative) {
      return res.status(400).json({ error: 'A valid file path is required.' });
    }

    const relativePath = normalizeRelativePath(relative);
    const absolutePath = resolveVolumePath(relativePath);
    await ensureDir(path.dirname(absolutePath));
    await fs.writeFile(absolutePath, content, { encoding: 'utf-8' });
    res.send({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error writing to the file');
    res.status(500).json({ error: 'Failed to update file.' });
  }
});

module.exports = router;

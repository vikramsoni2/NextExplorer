const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const { normalizeRelativePath, resolveVolumePath } = require('../utils/pathUtils');
const { extensions } = require('../config/index');
const { getThumbnail } = require('../services/thumbnailService');
const logger = require('../utils/logger');

const router = express.Router();
const { getSettings } = require('../services/appConfigService');

const isPreviewable = (extension = '') => {
  if (!extension) {
    return false;
  }
  return extensions.previewable.has(extension.toLowerCase());
};

router.get('/thumbnails/*', async (req, res) => {
  try {
    const settings = await getSettings();
    const thumbsEnabled = settings?.thumbnails?.enabled !== false;
    if (!thumbsEnabled) {
      return res.json({ thumbnail: '' });
    }
    const rawPath = req.params[0];
    const relativePath = normalizeRelativePath(rawPath);

    if (!relativePath) {
      return res.status(400).json({ error: 'A file path is required.' });
    }

    const absolutePath = resolveVolumePath(relativePath);
    const stats = await fs.stat(absolutePath);

    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Thumbnails are only available for files.' });
    }

    const extension = path.extname(relativePath).slice(1).toLowerCase();
    if (extension === 'pdf') {
      return res.status(400).json({ error: 'Thumbnails are not available for PDF files.' });
    }

    if (!isPreviewable(extension)) {
      return res.status(400).json({ error: 'Thumbnails are not available for this file type.' });
    }

    const thumbnail = await getThumbnail(absolutePath);
    res.json({ thumbnail: thumbnail || '' });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found.' });
    }

    logger.error({ err: error }, 'Failed to resolve thumbnail');
    res.status(500).json({ error: 'Failed to generate thumbnail.' });
  }
});

module.exports = router;

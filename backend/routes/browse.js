const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const { normalizeRelativePath, resolveVolumePath } = require('../utils/pathUtils');
const { pathExists } = require('../utils/fsUtils');
const { excludedFiles, extensions } = require('../config/index');
const {
  getThumbnailPathIfExists,
  queueThumbnailGeneration,
} = require('../services/thumbnailService');
const { getSettings } = require('../services/appConfigService');
const logger = require('../utils/logger');

const router = express.Router();
const { getPermissionForPath } = require('../services/accessControlService');
const previewable = new Set([
  ...extensions.images,
  ...extensions.videos,
  ...(extensions.documents || []),
]);

router.get('/browse/*', async (req, res) => {
  try {
    const settings = await getSettings();
    const thumbsEnabled = settings?.thumbnails?.enabled !== false;
    const relativePath = normalizeRelativePath(req.params[0]);
    const directoryPath = resolveVolumePath(relativePath);

    if (!(await pathExists(directoryPath))) {
      return res.status(404).json({ error: 'Path not found.' });
    }

    const files = await fs.readdir(directoryPath);
    const filteredFiles = files
      .filter((file) => !excludedFiles.includes(file))
      .filter((file) => path.extname(file).toLowerCase() !== '.download');

    const fileDataPromises = filteredFiles.map(async (file) => {
      const filePath = path.join(directoryPath, file);
      let stats;
      try {
        stats = await fs.stat(filePath);
      } catch (err) {
        // Gracefully skip entries we cannot stat due to permissions or races
        if (['EPERM', 'EACCES', 'ENOENT'].includes(err?.code)) {
          logger.warn({ filePath, err }, 'Skipping unreadable entry');
          return null;
        }
        throw err;
      }

      let extension = stats.isDirectory() ? 'directory' : path.extname(file).slice(1).toLowerCase();
      if (extension.length > 10) {
        extension = 'unknown';
      }

      const item = {
        name: file,
        path: relativePath,
        dateModified: stats.mtime,
        size: stats.size,
        kind: extension,
      };

      // Enforce hidden rules in listings
      const fullRel = relativePath ? `${relativePath}/${file}` : file;
      const perm = await getPermissionForPath(fullRel);
      if (perm === 'hidden') {
        return null;
      }

      if (thumbsEnabled && stats.isFile() && previewable.has(extension.toLowerCase()) && extension !== 'pdf') {
        try {
          const existingThumbnail = await getThumbnailPathIfExists(filePath);
          if (existingThumbnail) {
            item.thumbnail = existingThumbnail;
          } else {
            queueThumbnailGeneration(filePath);
          }
        } catch (error) {
          logger.warn({ filePath, err: error }, 'Failed to schedule thumbnail');
        }
      }

      return item;
    });

    const fileData = (await Promise.all(fileDataPromises)).filter(Boolean);
    res.json(fileData);
  } catch (error) {
    logger.error({ err: error }, 'Failed to read directory');
    res.status(500).json({ error: 'An error occurred while reading the directory.' });
  }
});

module.exports = router;

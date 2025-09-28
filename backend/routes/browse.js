const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const { normalizeRelativePath, resolveVolumePath } = require('../utils/pathUtils');
const { pathExists } = require('../utils/fsUtils');
const { excludedFiles, extensions } = require('../config/index');
const { getThumbnail } = require('../services/thumbnailService');

const router = express.Router();
const previewable = new Set([...extensions.images, ...extensions.videos]);

router.get('/browse/*', async (req, res) => {
  try {
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
      const stats = await fs.stat(filePath);

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

      if (stats.isFile() && previewable.has(extension.toLowerCase())) {
        try {
          item.thumbnail = await getThumbnail(filePath);
        } catch (error) {
          console.log(`Failed to generate thumbnail for ${filePath}: Continuing`, error);
        }
      }

      return item;
    });

    const fileData = await Promise.all(fileDataPromises);
    res.json(fileData);
  } catch (error) {
    console.error('Failed to read directory:', error);
    res.status(500).json({ error: 'An error occurred while reading the directory.' });
  }
});

module.exports = router;

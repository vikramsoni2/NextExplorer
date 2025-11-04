const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const { createUploadMiddleware } = require('../services/uploadService');
const { normalizeRelativePath } = require('../utils/pathUtils');
const { directories } = require('../config/index');
const logger = require('../utils/logger');

const router = express.Router();
const upload = createUploadMiddleware();

router.post('/upload', upload.fields([{ name: 'filedata', maxCount: 50 }]), async (req, res) => {
  try {
    if (!req.files || !Array.isArray(req.files.filedata) || req.files.filedata.length === 0) {
      return res.status(400).json({ error: 'No files were provided.' });
    }

    logger.debug({ files: req.files }, 'Upload request received');

    const fileData = [];

    for (const file of req.files.filedata) {
      const stats = await fs.stat(file.path);
      const relativeFilePath = normalizeRelativePath(path.relative(directories.volume, file.path));
      const parentPath = normalizeRelativePath(path.dirname(relativeFilePath));
      const storedName = path.basename(relativeFilePath);
      const extension = path.extname(storedName).toLowerCase().replace('.', '');

      fileData.push({
        name: storedName,
        path: parentPath,
        dateModified: stats.mtime,
        size: stats.size,
        kind: extension,
      });
    }

    res.json(fileData);
  } catch (error) {
    logger.error({ err: error }, 'Upload failed');
    res.status(500).send('Server error');
  }
});

module.exports = router;

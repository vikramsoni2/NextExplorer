const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const { createUploadMiddleware } = require('../services/uploadService');
const { normalizeRelativePath } = require('../utils/pathUtils');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');
const { ValidationError } = require('../errors/AppError');

const router = express.Router();
const upload = createUploadMiddleware();

router.post(
  '/upload',
  upload.fields([{ name: 'filedata', maxCount: 50 }]),
  asyncHandler(async (req, res) => {
    if (
      !req.files ||
      !Array.isArray(req.files.filedata) ||
      req.files.filedata.length === 0
    ) {
      throw new ValidationError('No files were provided.');
    }

    logger.debug({ files: req.files }, 'Upload request received');

    const fileData = [];

    for (const file of req.files.filedata) {
      const stats = await fs.stat(file.path);

      // Prefer logicalPath set by upload service; fall back to empty string
      const logicalPath = normalizeRelativePath(file.logicalPath || '');
      const parentPath = normalizeRelativePath(path.dirname(logicalPath));
      const storedName = path.basename(logicalPath || file.filename || '');
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
  }),
);

module.exports = router;

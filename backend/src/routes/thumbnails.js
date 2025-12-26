const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const { normalizeRelativePath } = require('../utils/pathUtils');
const { extensions } = require('../config/index');
const { getThumbnail } = require('../services/thumbnailService');
const { resolvePathWithAccess } = require('../services/accessManager');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');
const { ValidationError, NotFoundError } = require('../errors/AppError');

const router = express.Router();
const { getSettings } = require('../services/settingsService');

const isThumbnailable = (extension = '') => {
  if (!extension) {
    return false;
  }
  const ext = extension.toLowerCase();
  return (
    extensions.images.includes(ext) ||
    (extensions.rawImages || []).includes(ext) ||
    extensions.videos.includes(ext)
  );
};

router.get(
  '/thumbnails/*',
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const thumbsEnabled = settings?.thumbnails?.enabled !== false;
    if (!thumbsEnabled) {
      return res.json({ thumbnail: '' });
    }
    const rawPath = req.params[0];
    const relativePath = normalizeRelativePath(rawPath);

    if (!relativePath) {
      throw new ValidationError('A file path is required.');
    }

    const context = { user: req.user, guestSession: req.guestSession };
    let accessInfo;
    let resolved;
    try {
      ({ accessInfo, resolved } = await resolvePathWithAccess(
        context,
        relativePath,
      ));
    } catch (error) {
      throw new NotFoundError('File not found.');
    }

    if (!accessInfo || !accessInfo.canAccess || !accessInfo.canRead) {
      throw new NotFoundError(accessInfo?.denialReason || 'File not found.');
    }

    const { absolutePath, relativePath: logicalPath } = resolved;
    let stats;
    try {
      stats = await fs.stat(absolutePath);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new NotFoundError('File not found.');
      }
      throw error;
    }

    if (!stats.isFile()) {
      throw new ValidationError('Thumbnails are only available for files.');
    }

    const extension = path.extname(relativePath).slice(1).toLowerCase();
    if (extension === 'pdf') {
      throw new ValidationError('Thumbnails are not available for PDF files.');
    }

    if (!isThumbnailable(extension)) {
      throw new ValidationError(
        'Thumbnails are not available for this file type.',
      );
    }

    let thumbnail = '';
    try {
      thumbnail = await getThumbnail(absolutePath);
    } catch (error) {
      logger.warn(
        { absolutePath, err: error },
        'Thumbnail generation failed, falling back to original file',
      );
    }

    // If thumbnail generation failed or produced no result, fall back to the original file
    if (
      !thumbnail &&
      (extensions.images.includes(extension) ||
        (extensions.rawImages || []).includes(extension))
    ) {
      const previewUrl = `/api/preview?path=${encodeURIComponent(logicalPath)}`;
      return res.json({ thumbnail: previewUrl });
    }

    res.json({ thumbnail: thumbnail || '' });
  }),
);

module.exports = router;

const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const { normalizeRelativePath } = require('../utils/pathUtils');
const { pathExists } = require('../utils/fsUtils');
const { excludedFiles, extensions } = require('../config/index');
const { getSettings } = require('../services/settingsService');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError } = require('../errors/AppError');

const router = express.Router();
const { getPermissionForPath } = require('../services/accessControlService');
const { resolvePathWithAccess } = require('../services/accessManager');
const previewable = new Set([
  ...extensions.images,
  ...(extensions.rawImages || []),
  ...extensions.videos,
  ...(extensions.documents || []),
]);

router.get(
  '/browse/*',
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const thumbsEnabled = settings?.thumbnails?.enabled !== false;
    const rawPath = req.params[0] || '';
    const inputRelativePath = normalizeRelativePath(rawPath);

    const context = { user: req.user, guestSession: req.guestSession };
    let accessInfo;
    let resolved;
    try {
      ({ accessInfo, resolved } = await resolvePathWithAccess(
        context,
        inputRelativePath,
      ));
    } catch (error) {
      logger.warn(
        { path: rawPath, err: error },
        'Failed to resolve browse path',
      );
      throw new NotFoundError('Path not found.');
    }

    if (!accessInfo || !accessInfo.canAccess) {
      throw new NotFoundError(accessInfo?.denialReason || 'Access denied');
    }

    const { absolutePath: directoryPath, relativePath } = resolved;

    if (!(await pathExists(directoryPath))) {
      throw new NotFoundError('Path not found.');
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
        if (['EPERM', 'EACCES', 'ENOENT', 'ELOOP'].includes(err?.code)) {
          logger.warn({ filePath, err }, 'Skipping unreadable entry');
          return null;
        }
        if (['ELOOP'].includes(err?.code)) {
          logger.warn({ filePath, err }, 'Skipping cyclical symbolic links');
          return null;
        }
        throw err;
      }

      let extension = stats.isDirectory()
        ? 'directory'
        : path.extname(file).slice(1).toLowerCase();
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

      if (
        thumbsEnabled &&
        stats.isFile() &&
        previewable.has(extension.toLowerCase()) &&
        extension !== 'pdf'
      ) {
        item.supportsThumbnail = true;
      }

      return item;
    });

    const fileData = (await Promise.all(fileDataPromises)).filter(Boolean);

    const response = {
      items: fileData,
      access: {
        canRead: accessInfo.canRead,
        canWrite: accessInfo.canWrite,
        canUpload: accessInfo.canUpload,
        canDelete: accessInfo.canDelete,
        canShare: accessInfo.canShare,
        canDownload: accessInfo.canDownload,
      },
      path: relativePath,
    };

    // Add share metadata for breadcrumb display
    if (resolved?.shareInfo) {
      const share = resolved.shareInfo;
      const pathParts = (share.sourcePath || '').split('/').filter(Boolean);
      response.shareInfo = {
        label: share.label,
        sourceFolderName: pathParts[pathParts.length - 1] || '',
      };
    }

    res.json(response);
  }),
);

module.exports = router;

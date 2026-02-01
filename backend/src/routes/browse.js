const express = require('express');

const { normalizeRelativePath } = require('../utils/pathUtils');
const { pathExists } = require('../utils/fsUtils');
const { getSettings } = require('../services/settingsService');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError } = require('../errors/AppError');

const router = express.Router();
const { resolvePathWithAccess } = require('../services/accessManager');
const { listDirectoryItems } = require('../services/directoryListingService');

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
      ({ accessInfo, resolved } = await resolvePathWithAccess(context, inputRelativePath));
    } catch (error) {
      logger.warn({ path: rawPath, err: error }, 'Failed to resolve browse path');
      throw new NotFoundError('Path not found.');
    }

    if (!accessInfo || !accessInfo.canAccess) {
      throw new NotFoundError(accessInfo?.denialReason || 'Access denied');
    }

    const { absolutePath: directoryPath, relativePath } = resolved;

    if (!(await pathExists(directoryPath))) {
      throw new NotFoundError('Path not found.');
    }

    const fileData = await listDirectoryItems({
      absoluteDir: directoryPath,
      parentLogicalPath: relativePath,
      context,
      thumbsEnabled,
      excludeDownloadArtifacts: true,
      permissionRules: settings?.access?.rules || [],
    });

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
  })
);

module.exports = router;

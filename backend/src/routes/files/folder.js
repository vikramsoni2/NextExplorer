const path = require('path');
const fs = require('fs/promises');
const {
  normalizeRelativePath,
  findAvailableFolderName,
  ensureValidName,
} = require('../../utils/pathUtils');
const { ACTIONS, authorizeAndResolve } = require('../../services/authorizationService');
const asyncHandler = require('../../utils/asyncHandler');
const { ValidationError, ForbiddenError, NotFoundError } = require('../../errors/AppError');
const { buildItemMetadata } = require('./utils');

const router = require('express').Router();

router.post(
  '/files/folder',
  asyncHandler(async (req, res) => {
    const destination = req.body?.path ?? req.body?.destination ?? '';
    const requestedName = req.body?.name;

    const parentRelative = normalizeRelativePath(destination);

    // Prevent creating folders directly in the root path (no space / volume selected)
    if (!parentRelative || parentRelative.trim() === '') {
      throw new ValidationError(
        'Cannot create folders in the root path. Please select a specific volume or folder first.'
      );
    }

    const context = { user: req.user, guestSession: req.guestSession };
    const { allowed, accessInfo, resolved } = await authorizeAndResolve(
      context,
      parentRelative,
      ACTIONS.createFolder
    );
    if (!allowed || !resolved) {
      throw new ForbiddenError(accessInfo?.denialReason || 'Cannot create folders in this path.');
    }

    const { absolutePath: parentAbsolute } = resolved;

    let parentStats;
    try {
      parentStats = await fs.stat(parentAbsolute);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new NotFoundError('Destination path does not exist.');
      }
      throw error;
    }

    if (!parentStats.isDirectory()) {
      throw new ValidationError('Destination must be an existing directory.');
    }

    const baseName =
      typeof requestedName === 'string' && requestedName.trim()
        ? ensureValidName(requestedName)
        : 'Untitled Folder';

    const finalName = await findAvailableFolderName(parentAbsolute, baseName);
    const folderAbsolute = path.join(parentAbsolute, finalName);

    await fs.mkdir(folderAbsolute);

    const item = await buildItemMetadata(folderAbsolute, parentRelative, finalName);
    res.status(201).json({ success: true, item });
  })
);

module.exports = router;

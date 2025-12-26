const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const asyncHandler = require('../utils/asyncHandler');
const {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} = require('../errors/AppError');
const { getById } = require('../services/users');
const { directories, excludedFiles, features } = require('../config/index');
const {
  getVolumesForUser,
  getVolumeById,
  addVolumeToUser,
  updateUserVolume,
  removeVolumeFromUser,
} = require('../services/userVolumesService');

const router = express.Router();

/**
 * Ensure user is an admin
 */
const ensureAdmin = (req, res, next) => {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  if (!roles.includes('admin')) {
    throw new ForbiddenError('Admin access required.');
  }
  next();
};

/**
 * Ensure USER_VOLUMES feature is enabled
 */
const ensureUserVolumesEnabled = (req, res, next) => {
  if (!features.userVolumes) {
    throw new ForbiddenError('User volumes feature is not enabled.');
  }
  next();
};

// Middleware stack for all user volume routes
const volumeMiddleware = [ensureAdmin, ensureUserVolumesEnabled];

/**
 * GET /api/users/:userId/volumes - List volumes assigned to a user
 */
router.get(
  '/users/:userId/volumes',
  volumeMiddleware,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Verify user exists
    const user = await getById(userId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    const volumes = await getVolumesForUser(userId);
    res.json({ volumes });
  }),
);

/**
 * POST /api/users/:userId/volumes - Add a volume to a user
 */
router.post(
  '/users/:userId/volumes',
  volumeMiddleware,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { label, path: volumePath, accessMode } = req.body || {};

    // Verify user exists
    const user = await getById(userId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    const volume = await addVolumeToUser({
      userId,
      label,
      volumePath,
      accessMode: accessMode || 'readwrite',
    });

    res.status(201).json({ volume });
  }),
);

/**
 * PATCH /api/users/:userId/volumes/:volumeId - Update a user volume
 */
router.patch(
  '/users/:userId/volumes/:volumeId',
  volumeMiddleware,
  asyncHandler(async (req, res) => {
    const { userId, volumeId } = req.params;
    const { label, accessMode } = req.body || {};

    // Verify user exists
    const user = await getById(userId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    // Verify volume exists and belongs to this user
    const existing = await getVolumeById(volumeId);
    if (!existing || existing.userId !== userId) {
      throw new NotFoundError('Volume not found.');
    }

    const volume = await updateUserVolume(volumeId, { label, accessMode });
    res.json({ volume });
  }),
);

/**
 * DELETE /api/users/:userId/volumes/:volumeId - Remove a volume from a user
 */
router.delete(
  '/users/:userId/volumes/:volumeId',
  volumeMiddleware,
  asyncHandler(async (req, res) => {
    const { userId, volumeId } = req.params;

    // Verify user exists
    const user = await getById(userId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    // Verify volume exists and belongs to this user
    const existing = await getVolumeById(volumeId);
    if (!existing || existing.userId !== userId) {
      throw new NotFoundError('Volume not found.');
    }

    await removeVolumeFromUser(volumeId);
    res.status(204).end();
  }),
);

/**
 * GET /api/admin/browse-directories - Browse directories for volume assignment
 * Returns only directories (not files) for the admin to select from
 */
router.get(
  '/admin/browse-directories',
  volumeMiddleware,
  asyncHandler(async (req, res) => {
    const requestedPath = req.query.path || directories.volume;

    // Resolve and validate the path
    let targetPath;
    try {
      targetPath = path.resolve(requestedPath);
    } catch (err) {
      throw new ValidationError('Invalid path');
    }

    // Verify the path exists and is a directory
    let stats;
    try {
      stats = await fs.stat(targetPath);
    } catch (err) {
      throw new NotFoundError('Path not found');
    }

    if (!stats.isDirectory()) {
      throw new ValidationError('Path is not a directory');
    }

    // Read directory entries
    let entries;
    try {
      entries = await fs.readdir(targetPath, { withFileTypes: true });
    } catch (err) {
      throw new ForbiddenError('Cannot read directory');
    }

    // Filter to only directories and exclude hidden/system directories
    const dirs = entries
      .filter((entry) => entry.isDirectory())
      .filter((entry) => !entry.name.startsWith('.'))
      .filter((entry) => !excludedFiles.includes(entry.name))
      .map((entry) => ({
        name: entry.name,
        path: path.join(targetPath, entry.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Compute parent path (if not at root)
    const parentPath = path.dirname(targetPath);
    const hasParent = parentPath !== targetPath;

    res.json({
      current: targetPath,
      parent: hasParent ? parentPath : null,
      directories: dirs,
    });
  }),
);

module.exports = router;

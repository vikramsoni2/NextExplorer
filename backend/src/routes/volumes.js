const express = require('express');
const fs = require('fs/promises');

const { directories, excludedFiles, features } = require('../config/index');
const asyncHandler = require('../utils/asyncHandler');
const { getVolumesForUser } = require('../services/userVolumesService');

const router = express.Router();

/**
 * Get all volumes from VOLUME_ROOT (admin view or when USER_VOLUMES is disabled)
 */
const getAllVolumes = async () => {
  const entries = await fs.readdir(directories.volume, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !excludedFiles.includes(name))
    .map((name) => ({
      name,
      path: name,
      kind: 'volume',
    }));
};

router.get('/volumes', asyncHandler(async (req, res) => {
  const user = req.user;
  const isAdmin = user?.roles?.includes('admin');
  const userVolumesEnabled = features.userVolumes;

  // If USER_VOLUMES is disabled or user is admin, show all volumes from VOLUME_ROOT
  if (!userVolumesEnabled || isAdmin) {
    const volumeData = await getAllVolumes();
    return res.json(volumeData);
  }

  // For regular users when USER_VOLUMES is enabled, show only assigned volumes
  if (!user || !user.id) {
    return res.json([]);
  }

  const userVolumes = await getVolumesForUser(user.id);

  const volumeData = userVolumes.map((vol) => ({
    name: vol.label,
    path: vol.label, // Use label as the path identifier for navigation
    kind: 'volume',
    accessMode: vol.accessMode,
    actualPath: vol.path, // Include actual path for reference
  }));

  res.json(volumeData);
}));

module.exports = router;

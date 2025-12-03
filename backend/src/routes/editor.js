const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const { normalizeRelativePath } = require('../utils/pathUtils');
const { ensureDir } = require('../utils/fsUtils');
const { resolvePathWithAccess } = require('../services/accessManager');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');
const { ValidationError, ForbiddenError, NotFoundError } = require('../errors/AppError');

const router = express.Router();

router.post('/editor', asyncHandler(async (req, res) => {
  const { path: relative = '' } = req.body || {};
  if (typeof relative !== 'string' || !relative) {
    throw new ValidationError('A valid file path is required.');
  }

  const relativePath = normalizeRelativePath(relative);
  const context = { user: req.user, guestSession: req.guestSession };
  let accessInfo;
  let resolved;
  try {
    ({ accessInfo, resolved } = await resolvePathWithAccess(context, relativePath));
  } catch (error) {
    throw new NotFoundError('A valid file path is required.');
  }

  if (!accessInfo || !accessInfo.canAccess || !accessInfo.canRead) {
    throw new ForbiddenError(accessInfo?.denialReason || 'Access denied.');
  }

  const { absolutePath } = resolved;
  const stats = await fs.stat(absolutePath);

  if (stats.isDirectory()) {
    throw new ValidationError('Cannot open a directory in the editor.');
  }

  const data = await fs.readFile(absolutePath, { encoding: 'utf-8' });
  res.send({ content: data });
}));

router.put('/editor', asyncHandler(async (req, res) => {
  const { path: relative = '', content = '' } = req.body || {};
  if (typeof relative !== 'string' || !relative) {
    throw new ValidationError('A valid file path is required.');
  }

  const relativePath = normalizeRelativePath(relative);

  // Prevent creating files directly in the volume root
  // Check if the file would be created at the root level (no parent directory)
  if (!relativePath.includes('/') && !relativePath.includes(path.sep)) {
    throw new ValidationError('Cannot create files in the root volume path. Please select a specific volume first.');
  }

  const context = { user: req.user, guestSession: req.guestSession };
  let accessInfo;
  let resolved;
  try {
    ({ accessInfo, resolved } = await resolvePathWithAccess(context, relativePath));
  } catch (error) {
    throw new NotFoundError('A valid file path is required.');
  }

  if (!accessInfo || !accessInfo.canAccess || !accessInfo.canWrite) {
    throw new ForbiddenError(accessInfo?.denialReason || 'This path is read-only.');
  }

  const { absolutePath } = resolved;

  await ensureDir(path.dirname(absolutePath));
  await fs.writeFile(absolutePath, content, { encoding: 'utf-8' });
  res.send({ success: true });
}));

module.exports = router;

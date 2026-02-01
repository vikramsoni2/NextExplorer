const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const config = require('../config');
const { normalizeRelativePath } = require('../utils/pathUtils');
const { ensureDir } = require('../utils/fsUtils');
const { ACTIONS, authorizeAndResolve } = require('../services/authorizationService');
const asyncHandler = require('../utils/asyncHandler');
const {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  UnsupportedMediaTypeError,
} = require('../errors/AppError');

const router = express.Router();

const MAX_EDITOR_FILE_SIZE = config.editor?.maxFileSizeBytes ?? 1 * 1024 * 1024;
const VIDEO_EXTENSIONS = Array.isArray(config.extensions?.videos) ? config.extensions.videos : [];

function isProbablyBinaryBuffer(buffer) {
  const length = Math.min(buffer.length, 4096);
  if (!length) return false;

  let suspicious = 0;
  for (let index = 0; index < length; index += 1) {
    const byte = buffer[index];
    if (byte === 0) {
      return true;
    }
    if (byte < 7 || (byte > 13 && byte < 32)) {
      suspicious += 1;
    }
  }

  return suspicious / length > 0.3;
}

async function readTextFileBuffer(req, relative) {
  if (typeof relative !== 'string' || !relative) {
    throw new ValidationError('A valid file path is required.');
  }

  const relativePath = normalizeRelativePath(relative);
  const context = { user: req.user, guestSession: req.guestSession };
  let accessInfo;
  let resolved;
  try {
    const result = await authorizeAndResolve(context, relativePath, ACTIONS.read);
    if (!result.allowed || !result.resolved) {
      throw new ForbiddenError(result.accessInfo?.denialReason || 'Access denied.');
    }
    accessInfo = result.accessInfo;
    resolved = result.resolved;
  } catch (error) {
    if (error && error.isOperational) {
      throw error;
    }
    throw new NotFoundError('A valid file path is required.');
  }

  if (!accessInfo || !resolved) {
    throw new ForbiddenError(accessInfo?.denialReason || 'Access denied.');
  }

  const { absolutePath } = resolved;
  const stats = await fs.stat(absolutePath);

  if (stats.isDirectory()) {
    throw new ValidationError('Cannot open a directory in the editor.');
  }

  if (typeof stats.size === 'number' && stats.size > MAX_EDITOR_FILE_SIZE) {
    throw new ValidationError('This file is too large to open in the text editor.');
  }

  const ext = path.extname(absolutePath).slice(1).toLowerCase();
  if (VIDEO_EXTENSIONS.includes(ext)) {
    throw new UnsupportedMediaTypeError('This file type cannot be opened in the text editor.');
  }

  const buffer = await fs.readFile(absolutePath);
  if (isProbablyBinaryBuffer(buffer)) {
    throw new UnsupportedMediaTypeError(
      'This file appears to be binary and cannot be opened in the text editor.'
    );
  }

  return { buffer, absolutePath };
}

router.post(
  '/editor',
  asyncHandler(async (req, res) => {
    const { path: relative = '' } = req.body || {};
    const { buffer } = await readTextFileBuffer(req, relative);
    const data = buffer.toString('utf-8');
    res.send({ content: data });
  })
);

router.get(
  '/raw',
  asyncHandler(async (req, res) => {
    const relative = req.query?.path;
    const { buffer } = await readTextFileBuffer(req, relative);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buffer.toString('utf-8'));
  })
);

router.put(
  '/editor',
  asyncHandler(async (req, res) => {
    const { path: relative = '', content = '' } = req.body || {};
    if (typeof relative !== 'string' || !relative) {
      throw new ValidationError('A valid file path is required.');
    }

    const relativePath = normalizeRelativePath(relative);

    // Prevent creating files directly in the volume root
    // Check if the file would be created at the root level (no parent directory)
    if (!relativePath.includes('/') && !relativePath.includes(path.sep)) {
      throw new ValidationError(
        'Cannot create files in the root volume path. Please select a specific volume first.'
      );
    }

    const context = { user: req.user, guestSession: req.guestSession };
    let accessInfo;
    let resolved;
    try {
      const result = await authorizeAndResolve(context, relativePath, ACTIONS.write);
      if (!result.allowed || !result.resolved) {
        throw new ForbiddenError(result.accessInfo?.denialReason || 'This path is read-only.');
      }
      accessInfo = result.accessInfo;
      resolved = result.resolved;
    } catch (error) {
      if (error && error.isOperational) {
        throw error;
      }
      throw new NotFoundError('A valid file path is required.');
    }

    if (!accessInfo || !resolved) {
      throw new ForbiddenError(accessInfo?.denialReason || 'This path is read-only.');
    }

    const { absolutePath } = resolved;

    await ensureDir(path.dirname(absolutePath));
    await fs.writeFile(absolutePath, content, { encoding: 'utf-8' });
    res.send({ success: true });
  })
);

module.exports = router;

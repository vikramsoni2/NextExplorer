const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const AdmZip = require('adm-zip');

const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { pathExists } = require('../utils/fsUtils');
const {
  normalizeRelativePath,
  combineRelativePath,
  ensureValidName,
  findAvailableFolderName,
  findAvailableName,
} = require('../utils/pathUtils');
const { ValidationError, ForbiddenError, NotFoundError } = require('../errors/AppError');
const { ACTIONS, authorizeAndResolve } = require('../services/authorizationService');

const router = express.Router();

const buildItemMetadata = async (absolutePath, relativeParent, name) => {
  const stats = await fs.stat(absolutePath);
  const ext = path.extname(name).slice(1).toLowerCase();
  const kind = stats.isDirectory() ? 'directory' : ext.length > 10 ? 'unknown' : ext || 'unknown';

  return { name, path: relativeParent, kind, size: stats.size, dateModified: stats.mtime };
};

const defaultZipNameForItems = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return 'Archive.zip';
  if (items.length > 1) return 'Archive.zip';

  const { name = '', kind = '' } = items[0] || {};
  if (!name) return 'Archive.zip';

  if (String(kind).toLowerCase() === 'directory') return `${name}.zip`;

  const ext = path.extname(name);
  return `${ext ? name.slice(0, -ext.length) : name}.zip`;
};

router.post(
  '/files/zip/extract',
  asyncHandler(async (req, res) => {
    const inputPath = req.body?.path ?? '';
    if (typeof inputPath !== 'string' || !inputPath.trim()) {
      throw new ValidationError('A zip file path is required.');
    }

    const relativePath = normalizeRelativePath(inputPath);
    const context = { user: req.user, guestSession: req.guestSession };

    const { allowed, accessInfo, resolved } = await authorizeAndResolve(
      context,
      relativePath,
      ACTIONS.read
    ).catch(() => {
      throw new NotFoundError('File not found.');
    });
    if (!allowed || !resolved) {
      throw new ForbiddenError(accessInfo?.denialReason || 'Access denied.');
    }

    const zipAbsolutePath = resolved.absolutePath;
    if (!(await pathExists(zipAbsolutePath))) throw new NotFoundError('File not found.');

    const stats = await fs.stat(zipAbsolutePath);
    if (!stats.isFile()) throw new ValidationError('Only zip files can be extracted.');

    if (path.extname(zipAbsolutePath).toLowerCase() !== '.zip') {
      throw new ValidationError('Only .zip archives are supported.');
    }

    const parentRelativePath = normalizeRelativePath(
      path.posix.dirname(resolved.relativePath || '')
    );
    const {
      allowed: parentAllowed,
      accessInfo: parentAccessInfo,
      resolved: parentResolved,
    } = await authorizeAndResolve(context, parentRelativePath, ACTIONS.createFolder);
    if (!parentAllowed || !parentResolved) {
      throw new ForbiddenError(parentAccessInfo?.denialReason || 'Destination is read-only.');
    }

    const parentAbsolutePath = parentResolved?.absolutePath;
    if (!parentAbsolutePath) throw new ForbiddenError('Cannot resolve destination folder.');

    const parentStats = await fs.stat(parentAbsolutePath);
    if (!parentStats.isDirectory()) throw new ValidationError('Destination must be a directory.');

    const ext = path.extname(zipAbsolutePath);
    const zipBaseName = path.basename(zipAbsolutePath, ext);
    const baseFolderName = (() => {
      try {
        return ensureValidName(zipBaseName || 'Archive');
      } catch (_) {
        return 'Archive';
      }
    })();

    const folderName = await findAvailableFolderName(parentAbsolutePath, baseFolderName);
    const destinationFolderAbsolutePath = path.join(parentAbsolutePath, folderName);

    await fs.mkdir(destinationFolderAbsolutePath);

    try {
      new AdmZip(zipAbsolutePath).extractAllTo(destinationFolderAbsolutePath, true);
    } catch (error) {
      logger.warn({ zipAbsolutePath, err: error }, 'Zip extract failed; cleaning up folder');
      await fs.rm(destinationFolderAbsolutePath, { recursive: true, force: true });
      throw error;
    }

    const item = await buildItemMetadata(
      destinationFolderAbsolutePath,
      parentRelativePath,
      folderName
    );
    res.status(201).json({ success: true, item });
  })
);

router.post(
  '/files/zip/compress',
  asyncHandler(async (req, res) => {
    const { items = [], destination = '', name } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError('At least one item is required.');
    }

    const normalizedDestination = normalizeRelativePath(destination || items[0]?.path || '');

    if (!normalizedDestination.trim()) {
      throw new ValidationError(
        'Cannot create archives in the root path. Please select a specific volume or folder first.'
      );
    }

    const context = { user: req.user, guestSession: req.guestSession };
    const {
      allowed: destAllowed,
      accessInfo: destAccess,
      resolved: destResolved,
    } = await authorizeAndResolve(context, normalizedDestination, ACTIONS.write);
    if (!destAllowed || !destResolved) {
      throw new ForbiddenError(destAccess?.denialReason || 'Destination is read-only.');
    }

    const destinationAbsolutePath = destResolved.absolutePath;
    const destStats = await fs.stat(destinationAbsolutePath);
    if (!destStats.isDirectory()) throw new ValidationError('Destination must be a directory.');

    const sourceTargets = await Promise.all(
      items.map(async (item) => {
        if (!item || typeof item.name !== 'string') {
          throw new ValidationError('Each item must include a name.');
        }
        const itemParent = normalizeRelativePath(item.path || '');
        const itemRelative = combineRelativePath(itemParent, item.name);
        const { allowed, accessInfo, resolved } = await authorizeAndResolve(
          context,
          itemRelative,
          ACTIONS.read
        );
        if (!allowed || !resolved) {
          throw new ForbiddenError(accessInfo?.denialReason || 'Source item is not accessible.');
        }

        const stats = await fs.stat(resolved.absolutePath);
        return { name: item.name, absolutePath: resolved.absolutePath, stats };
      })
    );

    const requestedName = (() => {
      if (typeof name === 'string' && name.trim()) {
        const cleaned = ensureValidName(name.trim());
        return cleaned.toLowerCase().endsWith('.zip') ? cleaned : `${cleaned}.zip`;
      }
      return defaultZipNameForItems(items);
    })();

    const zipFileName = await findAvailableName(destinationAbsolutePath, requestedName);
    const zipAbsolutePath = path.join(destinationAbsolutePath, zipFileName);

    const zip = new AdmZip();
    sourceTargets.forEach(({ name: entryName, absolutePath, stats }) => {
      stats.isDirectory()
        ? zip.addLocalFolder(absolutePath, entryName)
        : zip.addLocalFile(absolutePath, '', entryName);
    });
    zip.writeZip(zipAbsolutePath);

    const item = await buildItemMetadata(zipAbsolutePath, normalizedDestination, zipFileName);
    res.status(201).json({ success: true, item });
  })
);

module.exports = router;

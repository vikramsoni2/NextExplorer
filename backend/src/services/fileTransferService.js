const path = require('path');
const fs = require('fs/promises');

const { ensureDir, pathExists } = require('../utils/fsUtils');
const {
  normalizeRelativePath,
  resolveItemPaths,
  combineRelativePath,
  findAvailableName,
} = require('../utils/pathUtils');
const { resolvePathWithAccess } = require('./accessManager');

const copyEntry = async (sourcePath, destinationPath, isDirectory) => {
  if (isDirectory) {
    if (typeof fs.cp === 'function') {
      await fs.cp(sourcePath, destinationPath, {
        recursive: true,
        force: false,
        errorOnExist: true,
      });
    } else {
      await ensureDir(destinationPath);
      const entries = await fs.readdir(sourcePath, { withFileTypes: true });
      for (const entry of entries) {
        const src = path.join(sourcePath, entry.name);
        const dest = path.join(destinationPath, entry.name);
        // eslint-disable-next-line no-await-in-loop
        await copyEntry(src, dest, entry.isDirectory());
      }
    }
  } else {
    await fs.copyFile(sourcePath, destinationPath);
  }
};

const moveEntry = async (sourcePath, destinationPath, isDirectory) => {
  try {
    await fs.rename(sourcePath, destinationPath);
  } catch (error) {
    if (error.code === 'EXDEV') {
      await copyEntry(sourcePath, destinationPath, isDirectory);
      await fs.rm(sourcePath, { recursive: isDirectory, force: true });
    } else {
      throw error;
    }
  }
};

const transferItems = async (items, destination, operation, options = {}) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one item is required.');
  }

  const destinationRelative = normalizeRelativePath(destination);

  // Prevent copying/moving items directly to the root path
  if (!destinationRelative || destinationRelative.trim() === '') {
    throw new Error(
      'Cannot copy or move items to the root path. Please select a specific volume or folder first.',
    );
  }

  const context = {
    user: options.user || null,
    guestSession: options.guestSession || null,
  };

  const { accessInfo: destAccess, resolved: destResolved } =
    await resolvePathWithAccess(context, destinationRelative);

  if (!destAccess || !destAccess.canAccess || !destAccess.canWrite) {
    throw new Error(
      destAccess?.denialReason || 'Destination path is not writable.',
    );
  }

  const { absolutePath: destinationAbsolute } = destResolved;

  await ensureDir(destinationAbsolute);

  const results = [];

  for (const item of items) {
    const sourceCombined = combineRelativePath(item.path || '', item.name);
    const { accessInfo: srcAccess, resolved: srcResolved } =
      await resolvePathWithAccess(context, sourceCombined);

    if (!srcAccess || !srcAccess.canAccess || !srcAccess.canRead) {
      throw new Error(
        srcAccess?.denialReason ||
          `Source path not accessible: ${sourceCombined}`,
      );
    }

    const { relativePath: sourceRelative, absolutePath: sourceAbsolute } =
      srcResolved;

    if (!(await pathExists(sourceAbsolute))) {
      throw new Error(`Source path not found: ${sourceRelative}`);
    }

    // Check delete permission for moves (move = delete from source)
    if (operation === 'move' && !srcAccess.canDelete) {
      throw new Error('Cannot move items from a read-only or protected path.');
    }

    const stats = await fs.stat(sourceAbsolute);
    const sourceParent = normalizeRelativePath(path.dirname(sourceRelative));

    if (operation === 'move' && destinationRelative === sourceParent) {
      results.push({ from: sourceRelative, to: sourceRelative, skipped: true });
      continue;
    }

    const desiredName = item.newName || item.name;
    const availableName = await findAvailableName(
      destinationAbsolute,
      desiredName,
    );
    const targetAbsolute = path.join(destinationAbsolute, availableName);
    const targetRelative = combineRelativePath(
      destinationRelative,
      availableName,
    );

    if (operation === 'copy') {
      await copyEntry(sourceAbsolute, targetAbsolute, stats.isDirectory());
    } else if (operation === 'move') {
      await moveEntry(sourceAbsolute, targetAbsolute, stats.isDirectory());
    } else {
      throw new Error(`Unsupported operation: ${operation}`);
    }

    results.push({ from: sourceRelative, to: targetRelative });
  }

  return { destination: destinationRelative, items: results };
};

const deleteItems = async (items = [], options = {}) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one item is required.');
  }

  const results = [];
  const context = {
    user: options.user || null,
    guestSession: options.guestSession || null,
  };

  for (const item of items) {
    const combined = combineRelativePath(item.path || '', item.name);
    const { accessInfo, resolved } = await resolvePathWithAccess(
      context,
      combined,
    );

    if (
      !accessInfo ||
      !accessInfo.canAccess ||
      !accessInfo.canDelete ||
      !resolved
    ) {
      throw new Error(
        accessInfo?.denialReason || 'Cannot delete items from this path.',
      );
    }

    const { relativePath, absolutePath } = resolved;

    if (!(await pathExists(absolutePath))) {
      results.push({ path: relativePath, status: 'missing' });
      continue;
    }

    const stats = await fs.stat(absolutePath);
    await fs.rm(absolutePath, { recursive: stats.isDirectory(), force: true });
    results.push({ path: relativePath, status: 'deleted' });
  }

  return results;
};

module.exports = {
  transferItems,
  deleteItems,
};

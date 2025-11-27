const path = require('path');
const fs = require('fs/promises');

const { ensureDir, pathExists } = require('../utils/fsUtils');
const {
  normalizeRelativePath,
  resolveVolumePath,
  resolveItemPaths,
  combineRelativePath,
  findAvailableName,
} = require('../utils/pathUtils');

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

const transferItems = async (items, destination, operation) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one item is required.');
  }

  const destinationRelative = normalizeRelativePath(destination);

  // Prevent copying/moving items directly to the volume root
  if (!destinationRelative || destinationRelative.trim() === '') {
    throw new Error('Cannot copy or move items to the root volume path. Please select a specific volume first.');
  }

  const destinationAbsolute = resolveVolumePath(destinationRelative);
  await ensureDir(destinationAbsolute);

  const results = [];

  for (const item of items) {
    const { relativePath: sourceRelative, absolutePath: sourceAbsolute } = resolveItemPaths(item);
    if (!(await pathExists(sourceAbsolute))) {
      throw new Error(`Source path not found: ${sourceRelative}`);
    }

    const stats = await fs.stat(sourceAbsolute);
    const sourceParent = normalizeRelativePath(path.dirname(sourceRelative));

    if (operation === 'move' && destinationRelative === sourceParent) {
      results.push({ from: sourceRelative, to: sourceRelative, skipped: true });
      continue;
    }

    const desiredName = item.newName || item.name;
    const availableName = await findAvailableName(destinationAbsolute, desiredName);
    const targetAbsolute = path.join(destinationAbsolute, availableName);
    const targetRelative = combineRelativePath(destinationRelative, availableName);

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

const deleteItems = async (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one item is required.');
  }

  const results = [];

  for (const item of items) {
    const { relativePath, absolutePath } = resolveItemPaths(item);
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

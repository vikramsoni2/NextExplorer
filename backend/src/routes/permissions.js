const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const { normalizeRelativePath, resolveLogicalPath } = require('../utils/pathUtils');
const { getPermissionForPath } = require('../services/accessControlService');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');
const { ValidationError, ForbiddenError, NotFoundError } = require('../errors/AppError');

const router = express.Router();
const execAsync = promisify(exec);

const assertWritable = async (relativePath) => {
  const perm = await getPermissionForPath(relativePath);
  if (perm !== 'rw') {
    throw new ForbiddenError('Path is read-only.');
  }
};

/**
 * Get file permissions, owner, and group information
 */
router.get('/permissions/*', asyncHandler(async (req, res) => {
  const rawPath = req.params[0] || '';
  const relativePath = normalizeRelativePath(rawPath);

  if (!relativePath) {
    throw new ValidationError('A file path is required.');
  }

  const perm = await getPermissionForPath(relativePath);
  if (perm === 'hidden') {
    throw new ForbiddenError('Path is not accessible.');
  }

  const { absolutePath } = await resolveLogicalPath(relativePath, { user: req.user });

  try {
    const stats = await fs.stat(absolutePath);

    // Get owner and group information
    // On Unix systems, we can use uid/gid, but we need the names
    let owner = stats.uid.toString();
    let group = stats.gid.toString();

    // Try to get username and group name (Unix/Linux/macOS)
    if (process.platform !== 'win32') {
      try {
        // Get owner name from uid
        const { stdout: ownerOut } = await execAsync(`id -nu ${stats.uid}`);
        owner = ownerOut.trim();
      } catch (e) {
        logger.debug({ err: e }, 'Failed to get owner name');
      }

      try {
        // Get group name from gid
        const { stdout: groupOut } = await execAsync(`id -gn ${stats.gid}`);
        group = groupOut.trim();
      } catch (e) {
        logger.debug({ err: e }, 'Failed to get group name');
      }
    }

    res.json({
      path: relativePath,
      mode: stats.mode,
      owner,
      group,
      uid: stats.uid,
      gid: stats.gid,
      isDirectory: stats.isDirectory()
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new NotFoundError('Path not found.');
    }
    throw error;
  }
}));

/**
 * Change file permissions (chmod)
 */
router.post('/permissions/chmod', asyncHandler(async (req, res) => {
  const { path: rawPath, mode, recursive } = req.body;

  if (!rawPath) {
    throw new ValidationError('Path is required.');
  }

  if (!mode || !/^[0-7]{3}$/.test(mode)) {
    throw new ValidationError('Mode must be a 3-digit octal string (e.g., "755").');
  }

  const relativePath = normalizeRelativePath(rawPath);
  await assertWritable(relativePath);

  const { absolutePath } = await resolveLogicalPath(relativePath, { user: req.user });

  try {
    // Check if path exists
    await fs.stat(absolutePath);

    // Use chmod via Node.js built-in
    const modeInt = parseInt(mode, 8);
    await fs.chmod(absolutePath, modeInt);

    // If recursive and directory, apply to all children
    if (recursive) {
      const stats = await fs.stat(absolutePath);
      if (stats.isDirectory()) {
        // Use chmod -R for recursive on Unix systems
        if (process.platform !== 'win32') {
          try {
            await execAsync(`chmod -R ${mode} "${absolutePath}"`);
          } catch (e) {
            logger.error({ err: e }, 'Failed to apply recursive chmod');
            throw new Error('Failed to apply permissions recursively.');
          }
        } else {
          // On Windows, we'd need to recursively walk the directory
          // For now, just apply to the top-level
          logger.warn('Recursive chmod not fully supported on Windows');
        }
      }
    }

    logger.info({ path: relativePath, mode, recursive }, 'Permissions changed');

    res.json({
      success: true,
      path: relativePath,
      mode: modeInt
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new NotFoundError('Path not found.');
    }
    if (error.code === 'EPERM' || error.code === 'EACCES') {
      throw new ForbiddenError('Permission denied to change permissions.');
    }
    throw error;
  }
}));

/**
 * Change file owner or group (chown)
 */
router.post('/permissions/chown', asyncHandler(async (req, res) => {
  const { path: rawPath, owner, group } = req.body;

  if (!rawPath) {
    throw new ValidationError('Path is required.');
  }

  if (!owner && !group) {
    throw new ValidationError('Either owner or group must be specified.');
  }

  const relativePath = normalizeRelativePath(rawPath);
  await assertWritable(relativePath);

  const { absolutePath } = await resolveLogicalPath(relativePath, { user: req.user });

  try {
    // Check if path exists
    await fs.stat(absolutePath);

    // chown requires shell execution as Node.js doesn't have built-in owner/group change
    // This requires elevated privileges on most systems
    if (process.platform !== 'win32') {
      let chownCmd = '';

      if (owner && group) {
        chownCmd = `chown "${owner}:${group}" "${absolutePath}"`;
      } else if (owner) {
        chownCmd = `chown "${owner}" "${absolutePath}"`;
      } else if (group) {
        chownCmd = `chgrp "${group}" "${absolutePath}"`;
      }

      try {
        await execAsync(chownCmd);
        logger.info({ path: relativePath, owner, group }, 'Ownership changed');
      } catch (e) {
        logger.error({ err: e }, 'Failed to change ownership');

        if (e.message.includes('Operation not permitted')) {
          throw new ForbiddenError('Permission denied. Changing ownership typically requires root/admin privileges.');
        }
        throw new Error('Failed to change ownership: ' + e.message);
      }
    } else {
      throw new ValidationError('Changing ownership is not supported on Windows.');
    }

    res.json({
      success: true,
      path: relativePath,
      owner,
      group
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new NotFoundError('Path not found.');
    }
    throw error;
  }
}));

module.exports = router;

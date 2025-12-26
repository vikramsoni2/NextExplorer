const path = require('path');
const fs = require('fs/promises');
const fss = require('fs');
const multer = require('multer');

const { ensureDir, pathExists } = require('../utils/fsUtils');
const {
  normalizeRelativePath,
  findAvailableName,
} = require('../utils/pathUtils');
const { readMetaField } = require('../utils/requestUtils');
const { getPermissionForPath } = require('./accessControlService');
const { resolvePathWithAccess } = require('./accessManager');
const logger = require('../utils/logger');

const resolveUploadPaths = async (req, file) => {
  const relativePathMeta = readMetaField(req, 'relativePath');
  const uploadToMeta = readMetaField(req, 'uploadTo');

  const uploadTo = normalizeRelativePath(uploadToMeta);
  const relativePath =
    normalizeRelativePath(relativePathMeta) || path.basename(file.originalname);

  const context = { user: req.user, guestSession: req.guestSession };
  const { accessInfo, resolved } = await resolvePathWithAccess(
    context,
    uploadTo,
  );

  if (!accessInfo || !accessInfo.canAccess || !accessInfo.canUpload) {
    throw new Error(
      accessInfo?.denialReason || 'Cannot upload files to this path.',
    );
  }

  const { absolutePath: destinationRoot, relativePath: logicalBase } = resolved;

  const destinationPath = path.join(destinationRoot, relativePath);
  const destinationDir = path.dirname(destinationPath);

  return {
    destinationPath,
    destinationDir,
    logicalBase,
    logicalRelativePath: normalizeRelativePath(
      path.join(logicalBase, relativePath),
    ),
  };
};

function CustomStorage() {
  // Custom multer storage engine for handling file uploads with:
  // - Access control checks
  // - Atomic-like writes via temporary files
  // - Automatic file name conflict resolution
}

CustomStorage.prototype._handleFile = function handleFile(req, file, cb) {
  (async () => {
    try {
      const { destinationPath, destinationDir, logicalRelativePath } =
        await resolveUploadPaths(req, file);

      // Enforce access control: destination directory must be writable
      const relDestDir = normalizeRelativePath(
        path.dirname(logicalRelativePath),
      );

      // Prevent uploading directly to the root path (no space / volume selected)
      if (!relDestDir || relDestDir.trim() === '') {
        throw new Error(
          'Cannot upload files to the root path. Please select a specific volume or folder first.',
        );
      }

      await ensureDir(destinationDir);

      const perm = await getPermissionForPath(relDestDir);
      if (perm !== 'rw') {
        throw new Error('Destination path is read-only.');
      }

      let finalPath = destinationPath;
      if (await pathExists(finalPath)) {
        const desiredName = path.basename(destinationPath);
        const availableName = await findAvailableName(
          destinationDir,
          desiredName,
        );
        finalPath = path.join(destinationDir, availableName);
      }

      const temporaryPath = `${finalPath}.uploading`;

      const cleanupTemporary = async () => {
        try {
          if (await pathExists(temporaryPath)) {
            await fs.rm(temporaryPath, { force: true });
          }
        } catch (cleanupErr) {
          logger.error(
            { temporaryPath, err: cleanupErr },
            'Failed to remove temporary upload file',
          );
        }
      };

      const outStream = fss.createWriteStream(temporaryPath);
      file.stream.pipe(outStream);

      const handleStreamError = async (streamErr) => {
        await cleanupTemporary();
        cb(streamErr);
      };

      file.stream.on('error', handleStreamError);
      outStream.on('error', handleStreamError);

      outStream.on('finish', async () => {
        try {
          await fs.rename(temporaryPath, finalPath);
          cb(null, {
            path: finalPath,
            size: outStream.bytesWritten,
            filename: path.basename(finalPath),
            logicalPath: logicalRelativePath,
          });
        } catch (renameErr) {
          await cleanupTemporary();
          cb(renameErr);
        }
      });
    } catch (uploadError) {
      cb(uploadError);
    }
  })();
};

CustomStorage.prototype._removeFile = function removeFile(req, file, cb) {
  if (!file || !file.path) {
    cb(null);
    return;
  }

  fs.unlink(file.path)
    .then(() => cb(null))
    .catch((error) => {
      if (error && error.code === 'ENOENT') {
        cb(null);
        return;
      }
      cb(error);
    });
};

const createUploadMiddleware = () => multer({ storage: new CustomStorage() });

module.exports = {
  createUploadMiddleware,
};

const path = require('path');
const fs = require('fs/promises');
const fss = require('fs');
const multer = require('multer');

const { ensureDir, pathExists } = require('../utils/fsUtils');
const { normalizeRelativePath, resolveVolumePath, findAvailableName } = require('../utils/pathUtils');
const { readMetaField } = require('../utils/requestUtils');
const { getPermissionForPath } = require('./accessControlService');
const logger = require('../utils/logger');

const resolveUploadPaths = (req, file) => {
  const relativePathMeta = readMetaField(req, 'relativePath');
  const uploadToMeta = readMetaField(req, 'uploadTo');

  const uploadTo = normalizeRelativePath(uploadToMeta);
  const relativePath = normalizeRelativePath(relativePathMeta) || path.basename(file.originalname);

  const destinationRoot = resolveVolumePath(uploadTo);
  const destinationPath = path.join(destinationRoot, relativePath);
  const destinationDir = path.dirname(destinationPath);

  return {
    destinationPath,
    destinationDir,
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
      const { destinationPath, destinationDir } = resolveUploadPaths(req, file);
      await ensureDir(destinationDir);

      // Enforce access control: destination directory must be writable
      const volumeRoot = resolveVolumePath('');
      const relDestDir = normalizeRelativePath(path.relative(volumeRoot, destinationDir));
      const perm = await getPermissionForPath(relDestDir);
      if (perm !== 'rw') {
        throw new Error('Destination path is read-only.');
      }

      let finalPath = destinationPath;
      if (await pathExists(finalPath)) {
        const desiredName = path.basename(destinationPath);
        const availableName = await findAvailableName(destinationDir, desiredName);
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
            'Failed to remove temporary upload file'
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

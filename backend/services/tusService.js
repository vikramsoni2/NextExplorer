const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const { Server } = require('@tus/server');
const { FileStore } = require('@tus/file-store');

const { directories } = require('../config');
const { ensureDir, pathExists } = require('../utils/fsUtils');
const { normalizeRelativePath, resolveVolumePath, findAvailableName } = require('../utils/pathUtils');

const TUS_ENDPOINT_PATH = '/api/uploads/tus';

async function moveFile(source, destination) {
  try {
    await fs.rename(source, destination);
    return;
  } catch (error) {
    if (error?.code !== 'EXDEV') {
      throw error;
    }
  }

  // Fallback to copy + delete when moving across devices or volumes.
  try {
    await fs.copyFile(source, destination);
  } catch (copyError) {
    // Best-effort cleanup if destination was partially written.
    await fs.rm(destination, { force: true }).catch(() => {});
    throw copyError;
  }

  await fs.rm(source, { force: true });
}

const createTusService = () => {
  const uploadDirectory = directories.tusUploads;

  const datastore = new FileStore({ directory: uploadDirectory });

  const tusServer = new Server({
    path: TUS_ENDPOINT_PATH,
    datastore,
    onUploadFinish: async (req, upload) => {
      const metadata = upload?.metadata || {};
      const uploadToMeta = typeof metadata.uploadTo === 'string' ? metadata.uploadTo : '';
      const relativePathMeta = typeof metadata.relativePath === 'string' ? metadata.relativePath : '';
      const fallbackName = typeof metadata.name === 'string' && metadata.name.trim() ? metadata.name : upload.id;

      try {
        const uploadTo = normalizeRelativePath(uploadToMeta);
        const relativePathNormalised = normalizeRelativePath(relativePathMeta) || normalizeRelativePath(fallbackName);

        const destinationRoot = resolveVolumePath(uploadTo);
        const destinationPath = path.join(destinationRoot, relativePathNormalised);
        const destinationDir = path.dirname(destinationPath);

        await ensureDir(destinationDir);

        let finalPath = destinationPath;
        if (await pathExists(finalPath)) {
          const availableName = await findAvailableName(destinationDir, path.basename(destinationPath));
          finalPath = path.join(destinationDir, availableName);
        }

        if (!upload?.storage || upload.storage.type !== 'file' || !upload.storage.path) {
          throw Object.assign(new Error('Upload storage did not provide a file path'), {
            status_code: 500,
            body: 'Upload storage misconfiguration\n',
          });
        }

        await moveFile(upload.storage.path, finalPath);

        // Remove the stored metadata to keep the tus cache directory tidy.
        if (typeof datastore.configstore?.delete === 'function') {
          try {
            await datastore.configstore.delete(upload.id);
          } catch (cleanupError) {
            console.warn('Unable to clean tus metadata file', cleanupError);
          }
        }

        return undefined;
      } catch (error) {
        console.error('Failed to finalize tus upload', error);

        // Bubble up the error with tus-compatible fields so the client is informed.
        throw Object.assign(
          error instanceof Error ? error : new Error(String(error)),
          {
            status_code: error?.status_code || 500,
            body: error?.body || 'Upload finalization failed\n',
          },
        );
      }
    },
  });

  const router = express.Router();

  router.all('*', async (req, res, next) => {
    try {
      // Ensure the tus handler receives the full request path so Location headers are correct.
      req.url = req.originalUrl || req.url;
      await tusServer.handle(req, res);
    } catch (error) {
      next(error);
    }
  });

  return {
    router,
    tusServer,
    uploadDirectory,
  };
};

const ensureTusDirectory = async () => {
  await ensureDir(directories.tusUploads);
};

module.exports = {
  createTusService,
  ensureTusDirectory,
  TUS_ENDPOINT_PATH,
};

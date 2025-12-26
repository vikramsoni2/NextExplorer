const path = require('path');
const crypto = require('crypto');
const fs = require('fs/promises');

const { ensureDir } = require('../utils/fsUtils');
const { directories } = require('../config/index');

let exiftoolSingleton = null;
let exiftoolCleanupRegistered = false;

const loadExiftool = () => {
  if (exiftoolSingleton) return exiftoolSingleton;
  try {
    // eslint-disable-next-line global-require
    const { exiftool } = require('exiftool-vendored');
    exiftoolSingleton = exiftool;

    if (!exiftoolCleanupRegistered) {
      exiftoolCleanupRegistered = true;
      const shutdown = async () => {
        try {
          await exiftoolSingleton?.end?.();
        } catch (_) {
          // ignore cleanup errors
        } finally {
          exiftoolSingleton = null;
        }
      };

      process.once('beforeExit', () => {
        shutdown().catch(() => {});
      });
      process.once('SIGINT', () => {
        shutdown().finally(() => process.exit(0));
      });
      process.once('SIGTERM', () => {
        shutdown().finally(() => process.exit(0));
      });
    }
  } catch (error) {
    exiftoolSingleton = null;
  }

  return exiftoolSingleton;
};

const RAW_PREVIEW_CACHE_VERSION = 1;
const inflight = new Map();

const hashForFile = async (filePath) => {
  const stat = await fs.stat(filePath);
  const hash = crypto.createHash('sha1');
  hash.update(filePath);
  hash.update(String(stat.size));
  hash.update(String(Math.floor(stat.mtimeMs)));
  return hash.digest('hex');
};

const pathExists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const ensureRawPreviewCacheDir = async () => {
  const dir = path.join(directories.cache, 'raw-previews');
  await ensureDir(dir);
  return dir;
};

const tryExtract = async (exiftool, method, inputPath, outputPath) => {
  try {
    await exiftool[method](inputPath, outputPath);
  } catch (_) {
    return false;
  }

  return pathExists(outputPath);
};

/**
 * Extract embedded preview JPEG from a RAW file into a cached file path.
 * Returns absolute path to a JPEG file.
 */
const getRawPreviewJpegPath = async (rawFilePath) => {
  if (!rawFilePath) {
    throw new Error('rawFilePath is required');
  }

  const exiftool = loadExiftool();
  if (!exiftool) {
    throw new Error('exiftool-vendored is not available');
  }

  const cacheDir = await ensureRawPreviewCacheDir();
  const key = await hashForFile(rawFilePath);
  const finalPath = path.join(
    cacheDir,
    `v${RAW_PREVIEW_CACHE_VERSION}-${key}.jpg`,
  );

  if (await pathExists(finalPath)) {
    return finalPath;
  }

  let pending = inflight.get(finalPath);
  if (!pending) {
    pending = (async () => {
      const tmpPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`;
      await ensureDir(path.dirname(finalPath));

      const extracted =
        (await tryExtract(exiftool, 'extractPreview', rawFilePath, tmpPath)) ||
        (await tryExtract(
          exiftool,
          'extractThumbnail',
          rawFilePath,
          tmpPath,
        )) ||
        (await tryExtract(exiftool, 'extractJpgFromRaw', rawFilePath, tmpPath));

      if (!extracted) {
        try {
          await fs.rm(tmpPath, { force: true });
        } catch (_) {
          // ignore
        }
        throw new Error('No embedded preview JPEG found');
      }

      await fs.rename(tmpPath, finalPath);
      return finalPath;
    })().finally(() => {
      inflight.delete(finalPath);
    });

    inflight.set(finalPath, pending);
  }

  return pending;
};

module.exports = {
  getRawPreviewJpegPath,
};

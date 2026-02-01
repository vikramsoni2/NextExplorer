const path = require('path');
const fs = require('fs/promises');
const fss = require('fs');
const archiver = require('archiver');
const { normalizeRelativePath } = require('../../utils/pathUtils');
const { resolvePathWithAccess } = require('../../services/accessManager');
const asyncHandler = require('../../utils/asyncHandler');
const {
  ValidationError,
  ForbiddenError,
} = require('../../errors/AppError');
const logger = require('../../utils/logger');
const {
  collectInputPaths,
  encodeContentDisposition,
  stripBasePath,
} = require('./utils');

const router = require('express').Router();

const handleDownloadRequest = async (paths, req, res, basePath = '') => {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new ValidationError('At least one path is required.');
  }

  const normalizedPaths = [
    ...new Set(paths.map((item) => normalizeRelativePath(item)).filter(Boolean)),
  ];
  if (normalizedPaths.length === 0) {
    throw new ValidationError('No valid paths provided.');
  }

  const baseNormalized = basePath ? normalizeRelativePath(basePath) : '';

  const context = { user: req.user, guestSession: req.guestSession };

  const targets = await Promise.all(
    normalizedPaths.map(async (relativePath) => {
      const { accessInfo, resolved } = await resolvePathWithAccess(context, relativePath);

      if (
        !accessInfo ||
        !accessInfo.canAccess ||
        !accessInfo.canRead ||
        !accessInfo.canDownload ||
        !resolved
      ) {
        throw new ForbiddenError(accessInfo?.denialReason || 'Download not allowed.');
      }

      const { absolutePath, relativePath: logicalPath } = resolved;
      const stats = await fs.stat(absolutePath);
      return { relativePath: logicalPath, absolutePath, stats };
    })
  );

  const hasDirectory = targets.some(({ stats }) => stats.isDirectory());
  const shouldArchive = hasDirectory || targets.length > 1;

  if (!shouldArchive) {
    const [{ absolutePath, relativePath }] = targets;
    const filename = (() => {
      if (!baseNormalized) {
        return path.basename(absolutePath);
      }

      const relativePosix = stripBasePath(relativePath, baseNormalized);
      const basename = relativePosix.split('/').pop();
      return basename || path.basename(absolutePath);
    })();
    // Allow dotfiles to be downloaded (by default Express blocks them)
    res.download(absolutePath, filename, { dotfiles: 'allow' }, (err) => {
      if (err) {
        logger.error({ err }, 'Download failed');
        if (!res.headersSent) {
          res.status(500).send('Failed to download file.');
        }
      }
    });
    return;
  }

  const archiveName = (() => {
    if (targets.length === 1) {
      const segments = targets[0].relativePath
        ? targets[0].relativePath.split(path.sep).filter(Boolean)
        : [];
      const baseName =
        segments.length > 0
          ? segments[segments.length - 1]
          : path.basename(targets[0].absolutePath);
      return `${baseName || 'download'}.zip`;
    }

    if (baseNormalized) {
      const segments = baseNormalized.split(path.sep).filter(Boolean);
      const baseName = segments.length > 0 ? segments[segments.length - 1] : baseNormalized;
      if (baseName) {
        return `${baseName}.zip`;
      }
    }

    return 'download.zip';
  })();

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', encodeContentDisposition(archiveName));

  const archive = archiver('zip', { zlib: { level: 1 } });
  archive.on('error', (archiveError) => {
    logger.error({ err: archiveError }, 'Archive creation failed');
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create archive.' });
    } else {
      res.end();
    }
  });

  archive.pipe(res);

  targets.forEach(({ relativePath, absolutePath, stats }) => {
    const entryNameRaw = stripBasePath(relativePath, baseNormalized);
    const entryName = entryNameRaw
      ? entryNameRaw.replace(/\\/g, '/').replace(/^\/+/, '')
      : path.basename(absolutePath);

    if (stats.isDirectory()) {
      archive.directory(absolutePath, entryName);
    } else {
      archive.file(absolutePath, {
        name: entryName || path.basename(absolutePath),
      });
    }
  });

  await archive.finalize();
};

router.post(
  '/download',
  asyncHandler(async (req, res) => {
    const basePath = req.body?.basePath || req.body?.currentPath || '';
    const paths = collectInputPaths(req.body?.path, req.body?.paths, req.body?.items);
    await handleDownloadRequest(paths, req, res, basePath);
  })
);

module.exports = router;

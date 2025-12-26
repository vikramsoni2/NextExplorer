const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const fss = require('fs');
const archiver = require('archiver');

const {
  transferItems,
  deleteItems,
} = require('../services/fileTransferService');
const {
  normalizeRelativePath,
  combineRelativePath,
  findAvailableFolderName,
  ensureValidName,
} = require('../utils/pathUtils');
const { pathExists } = require('../utils/fsUtils');
const { extensions, mimeTypes } = require('../config/index');
const { getPermissionForPath } = require('../services/accessControlService');
const { resolvePathWithAccess } = require('../services/accessManager');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');
const {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnsupportedMediaTypeError,
} = require('../errors/AppError');
const { getRawPreviewJpegPath } = require('../services/rawPreviewService');

const router = express.Router();

const assertWritable = async (relativePath) => {
  const perm = await getPermissionForPath(relativePath);
  if (perm !== 'rw') {
    throw new ForbiddenError('Path is read-only.');
  }
};

const buildItemMetadata = async (absolutePath, relativeParent, name) => {
  const stats = await fs.stat(absolutePath);
  const kind = stats.isDirectory()
    ? 'directory'
    : (() => {
        const extension = path.extname(name).slice(1).toLowerCase();
        return extension.length > 10 ? 'unknown' : extension || 'unknown';
      })();

  return {
    name,
    path: relativeParent,
    kind,
    size: stats.size,
    dateModified: stats.mtime,
  };
};

router.post(
  '/files/folder',
  asyncHandler(async (req, res) => {
    const destination = req.body?.path ?? req.body?.destination ?? '';
    const requestedName = req.body?.name;

    const parentRelative = normalizeRelativePath(destination);

    // Prevent creating folders directly in the root path (no space / volume selected)
    if (!parentRelative || parentRelative.trim() === '') {
      throw new ValidationError(
        'Cannot create folders in the root path. Please select a specific volume or folder first.',
      );
    }

    const context = { user: req.user, guestSession: req.guestSession };
    const { accessInfo, resolved } = await resolvePathWithAccess(
      context,
      parentRelative,
    );

    if (!accessInfo || !accessInfo.canAccess || !accessInfo.canCreateFolder) {
      throw new ForbiddenError(
        accessInfo?.denialReason || 'Cannot create folders in this path.',
      );
    }

    const { absolutePath: parentAbsolute } = resolved;

    let parentStats;
    try {
      parentStats = await fs.stat(parentAbsolute);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new NotFoundError('Destination path does not exist.');
      }
      throw error;
    }

    if (!parentStats.isDirectory()) {
      throw new ValidationError('Destination must be an existing directory.');
    }

    const baseName =
      typeof requestedName === 'string' && requestedName.trim()
        ? ensureValidName(requestedName)
        : 'Untitled Folder';

    const finalName = await findAvailableFolderName(parentAbsolute, baseName);
    const folderAbsolute = path.join(parentAbsolute, finalName);

    await fs.mkdir(folderAbsolute);

    const item = await buildItemMetadata(
      folderAbsolute,
      parentRelative,
      finalName,
    );
    res.status(201).json({ success: true, item });
  }),
);

router.post(
  '/files/rename',
  asyncHandler(async (req, res) => {
    const parentPath = req.body?.path ?? '';
    const originalName = req.body?.name;
    const newNameRaw = req.body?.newName;

    if (typeof originalName !== 'string' || !originalName) {
      throw new ValidationError('Original name is required.');
    }

    const parentRelative = normalizeRelativePath(parentPath);
    const context = { user: req.user, guestSession: req.guestSession };

    const { accessInfo: parentAccess, resolved: parentResolved } =
      await resolvePathWithAccess(context, parentRelative);

    if (!parentAccess || !parentAccess.canAccess || !parentAccess.canWrite) {
      throw new ForbiddenError(
        parentAccess?.denialReason || 'Destination path is read-only.',
      );
    }

    const { absolutePath: parentAbsolute } = parentResolved;

    const currentRelative = combineRelativePath(parentRelative, originalName);
    const { accessInfo: currentAccess, resolved: currentResolved } =
      await resolvePathWithAccess(context, currentRelative);

    if (!currentAccess || !currentAccess.canAccess || !currentAccess.canWrite) {
      throw new ForbiddenError(
        currentAccess?.denialReason || 'Cannot rename items in this path.',
      );
    }

    const { absolutePath: currentAbsolute } = currentResolved;

    if (!(await pathExists(currentAbsolute))) {
      throw new NotFoundError('Item not found.');
    }

    const validatedNewName =
      typeof newNameRaw === 'string' ? ensureValidName(newNameRaw) : null;

    if (!validatedNewName) {
      throw new ValidationError('A new name is required.');
    }

    if (validatedNewName === originalName) {
      const item = await buildItemMetadata(
        currentAbsolute,
        parentRelative,
        originalName,
      );
      res.json({ success: true, item });
      return;
    }

    const targetRelative = combineRelativePath(
      parentRelative,
      validatedNewName,
    );
    const { resolved: targetResolved } = await resolvePathWithAccess(
      context,
      targetRelative,
    );
    const { absolutePath: targetAbsolute } = targetResolved;

    if (await pathExists(targetAbsolute)) {
      throw new ConflictError(
        `The name "${validatedNewName}" is already taken.`,
      );
    }

    await fs.rename(currentAbsolute, targetAbsolute);

    const item = await buildItemMetadata(
      targetAbsolute,
      parentRelative,
      validatedNewName,
    );
    res.json({ success: true, item });
  }),
);

router.post(
  '/files/copy',
  asyncHandler(async (req, res) => {
    const { items = [], destination = '' } = req.body || {};
    // validate read on each source (hidden not allowed), write on destination
    for (const item of items) {
      if (!item || !item.name) continue;
      const srcRel = combineRelativePath(
        normalizeRelativePath(item.path || ''),
        item.name,
      );
      const perm = await getPermissionForPath(srcRel);
      if (perm === 'hidden') {
        throw new ForbiddenError('Source path is not accessible.');
      }
    }
    await assertWritable(normalizeRelativePath(destination));

    const result = await transferItems(items, destination, 'copy', {
      user: req.user,
      guestSession: req.guestSession,
    });
    res.json({ success: true, ...result });
  }),
);

router.post(
  '/files/move',
  asyncHandler(async (req, res) => {
    const { items = [], destination = '' } = req.body || {};
    for (const item of items) {
      const parent = normalizeRelativePath(item?.path || '');
      await assertWritable(parent);
    }
    await assertWritable(normalizeRelativePath(destination));

    const result = await transferItems(items, destination, 'move', {
      user: req.user,
      guestSession: req.guestSession,
    });
    res.json({ success: true, ...result });
  }),
);

router.delete(
  '/files',
  asyncHandler(async (req, res) => {
    const { items = [] } = req.body || {};
    for (const item of items) {
      const parent = normalizeRelativePath(item?.path || '');
      await assertWritable(parent);
    }
    const results = await deleteItems(items, {
      user: req.user,
      guestSession: req.guestSession,
    });
    res.json({ success: true, items: results });
  }),
);

const collectInputPaths = (...sources) => {
  const collected = [];

  const add = (value) => {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }

    if (typeof value === 'string') {
      if (value.trim()) {
        collected.push(value);
      }
      return;
    }

    if (value && typeof value === 'object') {
      if (typeof value.relativePath === 'string') {
        add(value.relativePath);
        return;
      }

      if (typeof value.path === 'string' && typeof value.name === 'string') {
        try {
          add(combineRelativePath(value.path, value.name));
        } catch (error) {
          // ignore invalid combined paths and continue collecting
        }
        return;
      }

      if (typeof value.path === 'string') {
        add(value.path);
      }
    }
  };

  sources.forEach(add);
  return collected;
};

const toPosix = (value = '') => value.replace(/\\/g, '/');

const encodeContentDisposition = (filename) => {
  // Check if filename contains non-ASCII characters
  const hasNonAscii = /[^\x00-\x7F]/.test(filename);

  if (!hasNonAscii) {
    // Simple case: filename is ASCII-only
    return `attachment; filename="${filename}"`;
  }

  // For non-ASCII filenames, use RFC 5987 encoding
  // Create ASCII fallback (replace non-ASCII with underscores)
  const asciiFallback = filename.replace(/[^\x00-\x7F]/g, '_');

  // Encode filename for filename* parameter (RFC 5987)
  const encodedFilename = encodeURIComponent(filename);

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`;
};

const stripBasePath = (relativePath, basePath) => {
  const relPosix = toPosix(relativePath);
  const basePosix = toPosix(basePath);

  if (!basePosix) {
    return relPosix;
  }

  if (relPosix === basePosix) {
    const segments = relPosix.split('/');
    return segments[segments.length - 1] || relPosix;
  }

  const basePrefix = basePosix.endsWith('/') ? basePosix : `${basePosix}/`;
  if (relPosix.startsWith(basePrefix)) {
    const trimmed = relPosix.slice(basePrefix.length);
    return trimmed || relPosix.split('/').pop() || relPosix;
  }

  return relPosix;
};

const handleDownloadRequest = async (paths, req, res, basePath = '') => {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new ValidationError('At least one path is required.');
  }

  const normalizedPaths = [
    ...new Set(
      paths.map((item) => normalizeRelativePath(item)).filter(Boolean),
    ),
  ];
  if (normalizedPaths.length === 0) {
    throw new ValidationError('No valid paths provided.');
  }

  const baseNormalized = basePath ? normalizeRelativePath(basePath) : '';

  const context = { user: req.user, guestSession: req.guestSession };

  const targets = await Promise.all(
    normalizedPaths.map(async (relativePath) => {
      const { accessInfo, resolved } = await resolvePathWithAccess(
        context,
        relativePath,
      );

      if (
        !accessInfo ||
        !accessInfo.canAccess ||
        !accessInfo.canRead ||
        !accessInfo.canDownload ||
        !resolved
      ) {
        throw new ForbiddenError(
          accessInfo?.denialReason || 'Download not allowed.',
        );
      }

      const { absolutePath, relativePath: logicalPath } = resolved;
      const stats = await fs.stat(absolutePath);
      return { relativePath: logicalPath, absolutePath, stats };
    }),
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
      const baseName =
        segments.length > 0 ? segments[segments.length - 1] : baseNormalized;
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
    const paths = collectInputPaths(
      req.body?.path,
      req.body?.paths,
      req.body?.items,
    );
    await handleDownloadRequest(paths, req, res, basePath);
  }),
);

router.get(
  '/preview',
  asyncHandler(async (req, res) => {
    const { path: relative = '' } = req.query || {};
    if (typeof relative !== 'string' || !relative) {
      throw new ValidationError('A file path is required.');
    }

    const relativePath = normalizeRelativePath(relative);
    const context = { user: req.user, guestSession: req.guestSession };
    const { accessInfo, resolved } = await resolvePathWithAccess(
      context,
      relativePath,
    );

    if (!accessInfo || !accessInfo.canAccess || !accessInfo.canRead) {
      throw new ForbiddenError(
        accessInfo?.denialReason || 'Preview not allowed.',
      );
    }

    const { absolutePath } = resolved;
    const stats = await fs.stat(absolutePath);

    if (stats.isDirectory()) {
      throw new ValidationError('Cannot preview a directory.');
    }

    const extension = path.extname(absolutePath).slice(1).toLowerCase();

    if ((extensions.rawImages || []).includes(extension)) {
      let jpegPath;
      try {
        jpegPath = await getRawPreviewJpegPath(absolutePath);
      } catch (error) {
        logger.warn(
          { absolutePath, err: error },
          'Failed to extract embedded RAW preview',
        );
        throw new UnsupportedMediaTypeError(
          'Preview is not available for this RAW file.',
        );
      }

      const jpegStats = await fs.stat(jpegPath);

      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': jpegStats.size,
      });

      const stream = fss.createReadStream(jpegPath);
      stream.on('error', (streamError) => {
        logger.error({ err: streamError }, 'RAW preview stream failed');
        if (!res.headersSent) {
          res.status(500).end();
        } else {
          res.destroy(streamError);
        }
      });
      stream.pipe(res);
      return;
    }

    if (!extensions.previewable.has(extension)) {
      throw new UnsupportedMediaTypeError(
        'Preview is not available for this file type.',
      );
    }

    const mimeType = mimeTypes[extension] || 'application/octet-stream';
    const isSeekableMedia =
      extensions.videos.includes(extension) ||
      (extensions.audios || []).includes(extension);

    const streamFile = (options = undefined) => {
      const stream = options
        ? fss.createReadStream(absolutePath, options)
        : fss.createReadStream(absolutePath);
      stream.on('error', (streamError) => {
        logger.error({ err: streamError }, 'Preview stream failed');
        if (!res.headersSent) {
          res.status(500).end();
        } else {
          res.destroy(streamError);
        }
      });
      stream.pipe(res);
    };

    if (isSeekableMedia) {
      const rangeHeader = req.headers.range;
      if (rangeHeader) {
        const bytesPrefix = 'bytes=';
        if (!rangeHeader.startsWith(bytesPrefix)) {
          res.status(416).send('Malformed Range header');
          return;
        }

        const [startString, endString] = rangeHeader
          .slice(bytesPrefix.length)
          .split('-');
        let start = Number(startString);
        let end = endString ? Number(endString) : stats.size - 1;

        if (Number.isNaN(start)) start = 0;
        if (Number.isNaN(end) || end >= stats.size) end = stats.size - 1;

        if (start > end) {
          res.status(416).send('Range Not Satisfiable');
          return;
        }

        const chunkSize = end - start + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mimeType,
        });
        streamFile({ start, end });
        return;
      }

      res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Length': stats.size,
        'Accept-Ranges': 'bytes',
      });
      streamFile();
      return;
    }

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': stats.size,
    });
    streamFile();
  }),
);

module.exports = router;

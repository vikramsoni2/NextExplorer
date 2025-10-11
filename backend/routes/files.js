const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const fss = require('fs');
const archiver = require('archiver');

const { transferItems, deleteItems } = require('../services/fileTransferService');
const {
  normalizeRelativePath,
  resolveVolumePath,
  combineRelativePath,
  findAvailableFolderName,
  ensureValidName,
} = require('../utils/pathUtils');
const { pathExists } = require('../utils/fsUtils');
const { extensions, mimeTypes } = require('../config/index');
const { getPermissionForPath } = require('../services/accessControlService');

const router = express.Router();

const assertWritable = async (relativePath) => {
  const perm = await getPermissionForPath(relativePath);
  if (perm !== 'rw') {
    const err = new Error('Path is read-only.');
    err.status = 403;
    throw err;
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

router.post('/files/folder', async (req, res) => {
  try {
    const destination = req.body?.path ?? req.body?.destination ?? '';
    const requestedName = req.body?.name;

    const parentRelative = normalizeRelativePath(destination);
    await assertWritable(parentRelative);
    const parentAbsolute = resolveVolumePath(parentRelative);

    let parentStats;
    try {
      parentStats = await fs.stat(parentAbsolute);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Destination path does not exist.');
      }
      throw error;
    }

    if (!parentStats.isDirectory()) {
      throw new Error('Destination must be an existing directory.');
    }

    const baseName = typeof requestedName === 'string' && requestedName.trim()
      ? ensureValidName(requestedName)
      : 'Untitled Folder';

    const finalName = await findAvailableFolderName(parentAbsolute, baseName);
    const folderAbsolute = path.join(parentAbsolute, finalName);

    await fs.mkdir(folderAbsolute);

    const item = await buildItemMetadata(folderAbsolute, parentRelative, finalName);
    res.status(201).json({ success: true, item });
  } catch (error) {
    console.error('Create folder failed:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/files/rename', async (req, res) => {
  try {
    const parentPath = req.body?.path ?? '';
    const originalName = req.body?.name;
    const newNameRaw = req.body?.newName;

    if (typeof originalName !== 'string' || !originalName) {
      throw new Error('Original name is required.');
    }

    const parentRelative = normalizeRelativePath(parentPath);
    const parentAbsolute = resolveVolumePath(parentRelative);

    const currentRelative = combineRelativePath(parentRelative, originalName);
    const currentAbsolute = resolveVolumePath(currentRelative);

    await assertWritable(parentRelative);

    if (!(await pathExists(currentAbsolute))) {
      throw new Error('Item not found.');
    }

    const validatedNewName = typeof newNameRaw === 'string'
      ? ensureValidName(newNameRaw)
      : null;

    if (!validatedNewName) {
      throw new Error('A new name is required.');
    }

    if (validatedNewName === originalName) {
      const item = await buildItemMetadata(currentAbsolute, parentRelative, originalName);
      res.json({ success: true, item });
      return;
    }

    const targetRelative = combineRelativePath(parentRelative, validatedNewName);
    const targetAbsolute = resolveVolumePath(targetRelative);

    if (await pathExists(targetAbsolute)) {
      throw new Error(`The name "${validatedNewName}" is already taken.`);
    }

    await fs.rename(currentAbsolute, targetAbsolute);

    const item = await buildItemMetadata(targetAbsolute, parentRelative, validatedNewName);
    res.json({ success: true, item });
  } catch (error) {
    console.error('Rename operation failed:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/files/copy', async (req, res) => {
  try {
    const { items = [], destination = '' } = req.body || {};
    // validate read on each source (hidden not allowed), write on destination
    for (const item of items) {
      if (!item || !item.name) continue;
      const srcRel = combineRelativePath(normalizeRelativePath(item.path || ''), item.name);
      const perm = await getPermissionForPath(srcRel);
      if (perm === 'hidden') {
        throw new Error('Source path is not accessible.');
      }
    }
    await assertWritable(normalizeRelativePath(destination));

    const result = await transferItems(items, destination, 'copy');
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Copy operation failed:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/files/move', async (req, res) => {
  try {
    const { items = [], destination = '' } = req.body || {};
    for (const item of items) {
      const parent = normalizeRelativePath(item?.path || '');
      await assertWritable(parent);
    }
    await assertWritable(normalizeRelativePath(destination));

    const result = await transferItems(items, destination, 'move');
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Move operation failed:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/files', async (req, res) => {
  try {
    const { items = [] } = req.body || {};
    for (const item of items) {
      const parent = normalizeRelativePath(item?.path || '');
      await assertWritable(parent);
    }
    const results = await deleteItems(items);
    res.json({ success: true, items: results });
  } catch (error) {
    console.error('Delete operation failed:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

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

const handleDownloadRequest = async (paths, res, basePath = '') => {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error('At least one path is required.');
  }

  const normalizedPaths = [...new Set(paths.map((item) => normalizeRelativePath(item)).filter(Boolean))];
  if (normalizedPaths.length === 0) {
    throw new Error('No valid paths provided.');
  }

  const baseNormalized = basePath ? normalizeRelativePath(basePath) : '';

  const targets = await Promise.all(normalizedPaths.map(async (relativePath) => {
    const absolutePath = resolveVolumePath(relativePath);
    const stats = await fs.stat(absolutePath);
    return { relativePath, absolutePath, stats };
  }));

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
    res.download(absolutePath, filename, (err) => {
      if (err) {
        console.error('Download failed:', err);
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
      const baseName = segments.length > 0
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
  res.setHeader('Content-Disposition', `attachment; filename="${archiveName}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (archiveError) => {
    console.error('Archive creation failed:', archiveError);
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
      archive.file(absolutePath, { name: entryName || path.basename(absolutePath) });
    }
  });

  await archive.finalize();
};

router.post('/download', async (req, res) => {
  try {
    const basePath = req.body?.basePath || req.body?.currentPath || '';
    const paths = collectInputPaths(req.body?.path, req.body?.paths, req.body?.items);
    await handleDownloadRequest(paths, res, basePath);
  } catch (error) {
    console.error('Download request failed:', error);
    if (!res.headersSent) {
      res.status(400).json({ error: error.message });
    }
  }
});

router.get('/preview', async (req, res) => {
  try {
    const { path: relative = '' } = req.query || {};
    if (typeof relative !== 'string' || !relative) {
      return res.status(400).json({ error: 'A file path is required.' });
    }

    const relativePath = normalizeRelativePath(relative);
    const absolutePath = resolveVolumePath(relativePath);
    const stats = await fs.stat(absolutePath);

    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Cannot preview a directory.' });
    }

    const extension = path.extname(absolutePath).slice(1).toLowerCase();

    if (!extensions.previewable.has(extension)) {
      return res.status(415).json({ error: 'Preview is not available for this file type.' });
    }

    const mimeType = mimeTypes[extension] || 'application/octet-stream';
    const isVideo = extensions.videos.includes(extension);

    const streamFile = (options = undefined) => {
      const stream = options ? fss.createReadStream(absolutePath, options) : fss.createReadStream(absolutePath);
      stream.on('error', (streamError) => {
        console.error('Preview stream failed:', streamError);
        if (!res.headersSent) {
          res.status(500).end();
        } else {
          res.destroy(streamError);
        }
      });
      stream.pipe(res);
    };

    if (isVideo) {
      const rangeHeader = req.headers.range;
      if (rangeHeader) {
        const bytesPrefix = 'bytes=';
        if (!rangeHeader.startsWith(bytesPrefix)) {
          res.status(416).send('Malformed Range header');
          return;
        }

        const [startString, endString] = rangeHeader.slice(bytesPrefix.length).split('-');
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
  } catch (error) {
    console.error('Preview request failed:', error);
    if (!res.headersSent) {
      res.status(400).json({ error: error.message });
    } else {
      res.end();
    }
  }
});

module.exports = router;

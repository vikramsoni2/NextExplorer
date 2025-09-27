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
} = require('../utils/pathUtils');
const { extensions, mimeTypes } = require('../config/index');

const router = express.Router();

router.post('/files/copy', async (req, res) => {
  try {
    const { items = [], destination = '' } = req.body || {};
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

const path = require('path');
const fs = require('fs/promises');
const fss = require('fs');
const { normalizeRelativePath } = require('../../utils/pathUtils');
const { resolvePathWithAccess } = require('../../services/accessManager');
const { extensions, mimeTypes } = require('../../config/index');
const { getRawPreviewJpegPath } = require('../../services/rawPreviewService');
const asyncHandler = require('../../utils/asyncHandler');
const {
  ValidationError,
  ForbiddenError,
  UnsupportedMediaTypeError,
} = require('../../errors/AppError');
const logger = require('../../utils/logger');

const router = require('express').Router();

router.get(
  '/preview',
  asyncHandler(async (req, res) => {
    const { path: relative = '' } = req.query || {};
    if (typeof relative !== 'string' || !relative) {
      throw new ValidationError('A file path is required.');
    }

    const relativePath = normalizeRelativePath(relative);
    const context = { user: req.user, guestSession: req.guestSession };
    const { accessInfo, resolved } = await resolvePathWithAccess(context, relativePath);

    if (!accessInfo || !accessInfo.canAccess || !accessInfo.canRead) {
      throw new ForbiddenError(accessInfo?.denialReason || 'Preview not allowed.');
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
        logger.warn({ absolutePath, err: error }, 'Failed to extract embedded RAW preview');
        throw new UnsupportedMediaTypeError('Preview is not available for this RAW file.');
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
      throw new UnsupportedMediaTypeError('Preview is not available for this file type.');
    }

    const mimeType = mimeTypes[extension] || 'application/octet-stream';
    const isSeekableMedia =
      extensions.videos.includes(extension) || (extensions.audios || []).includes(extension);

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
  })
);

module.exports = router;

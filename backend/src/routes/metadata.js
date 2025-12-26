const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
let exifr = null;

const { normalizeRelativePath } = require('../utils/pathUtils');
const { extensions } = require('../config/index');
const { resolvePathWithAccess } = require('../services/accessManager');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');
const {
  ValidationError,
  ForbiddenError,
  NotFoundError,
} = require('../errors/AppError');

const router = express.Router();

// Optional: try to require exifr only when route is hit
const loadExifr = () => {
  if (exifr) return exifr;
  try {
    // eslint-disable-next-line global-require
    exifr = require('exifr');
  } catch (e) {
    exifr = null;
  }
  return exifr;
};

const probeVideo = (filePath) =>
  new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (error, data) => {
      if (error || !data) {
        resolve(null);
        return;
      }
      try {
        const stream =
          (data.streams || []).find((s) => s.width && s.height) || {};
        const duration = Number(data.format?.duration) || null;
        resolve({
          width: Number(stream.width) || null,
          height: Number(stream.height) || null,
          duration,
        });
      } catch (_) {
        resolve(null);
      }
    });
  });

const sumDirectory = async (dirPath, limit = 200000) => {
  const stack = [dirPath];
  let totalSize = 0;
  let fileCount = 0;
  let dirCount = 0;
  let visited = 0;

  while (stack.length) {
    const current = stack.pop();
    visited += 1;
    if (visited > limit) {
      break;
    }
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      try {
        const stat = await fs.stat(full);
        if (stat.isDirectory()) {
          dirCount += 1;
          stack.push(full);
        } else if (stat.isFile()) {
          fileCount += 1;
          totalSize += stat.size;
        }
      } catch (_) {
        // skip unreadable entries
      }
    }
  }

  return { totalSize, fileCount, dirCount, truncated: visited > limit };
};

router.get(
  '/metadata/*',
  asyncHandler(async (req, res) => {
    const rawPath = req.params[0] || '';
    const relativePath = normalizeRelativePath(rawPath);
    if (!relativePath) {
      throw new ValidationError('A file path is required.');
    }

    const context = { user: req.user, guestSession: req.guestSession };
    let accessInfo;
    let resolved;
    try {
      ({ accessInfo, resolved } = await resolvePathWithAccess(
        context,
        relativePath,
      ));
    } catch (error) {
      throw new NotFoundError('Path not found.');
    }

    if (!accessInfo || !accessInfo.canAccess || !accessInfo.canRead) {
      // For metadata, treat denied access as forbidden (explicit signal to caller)
      throw new ForbiddenError(
        accessInfo?.denialReason || 'Path is not accessible.',
      );
    }

    const absolutePath = resolved.absolutePath;
    const logicalPath = resolved.relativePath;
    const stats = await fs.stat(absolutePath);
    const name = path.basename(logicalPath);
    const ext = path.extname(logicalPath).slice(1).toLowerCase();

    const base = {
      path: logicalPath,
      name,
      kind: stats.isDirectory() ? 'directory' : ext || 'unknown',
      size: stats.size,
      dateModified: stats.mtime,
      dateCreated: stats.birthtime,
    };

    const payload = { ...base };

    if (stats.isDirectory()) {
      payload.directory = await sumDirectory(absolutePath);
      return res.json(payload);
    }

    // File-specific metadata
    if (extensions.images.includes(ext)) {
      try {
        const meta = await sharp(absolutePath).metadata();
        payload.image = {
          width: meta.width || null,
          height: meta.height || null,
          orientation: meta.orientation || null,
        };
      } catch (e) {
        logger.debug({ err: e }, 'sharp.metadata failed');
      }

      try {
        const ex = loadExifr()
          ? await exifr.parse(absolutePath, {
              tiff: true,
              ifd0: true,
              exif: true,
              gps: true,
              iptc: true,
            })
          : null;
        if (ex) {
          payload.image = Object.assign(payload.image || {}, {
            cameraMake: ex.Make || ex.make || null,
            cameraModel: ex.Model || ex.model || null,
            lensModel: ex.LensModel || ex.lensModel || null,
            software: ex.Software || null,
            dateTaken:
              ex.DateTimeOriginal || ex.CreateDate || ex.ModifyDate || null,
            gps:
              ex.latitude && ex.longitude
                ? { lat: ex.latitude, lon: ex.longitude }
                : ex.GPSLatitude && ex.GPSLongitude
                  ? { lat: ex.GPSLatitude, lon: ex.GPSLongitude }
                  : null,
          });
        }
      } catch (e) {
        logger.debug({ err: e }, 'EXIF parse failed');
      }
    } else if (extensions.videos.includes(ext)) {
      const v = await probeVideo(absolutePath);
      if (v) payload.video = v;
    }

    try {
      return res.json(payload);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new NotFoundError('Path not found.');
      }
      throw error;
    }
  }),
);

module.exports = router;

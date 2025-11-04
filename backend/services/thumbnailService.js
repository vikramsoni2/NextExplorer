const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');

const fsPromises = fs.promises;

const { ensureDir } = require('../utils/fsUtils');
const { directories, extensions } = require('../config/index');
const { getSettings } = require('./appConfigService');
const logger = require('../utils/logger');

const getThumbOptions = async () => {
  const settings = await getSettings();
  const size = Number.isFinite(settings?.thumbnails?.size) ? settings.thumbnails.size : 200;
  const quality = Number.isFinite(settings?.thumbnails?.quality) ? settings.thumbnails.quality : 70;
  return { size, quality };
};

const currentConcurrency = sharp.concurrency();
sharp.concurrency(Math.max(1, Math.min(8, currentConcurrency)));
sharp.cache({ memory: 256, files: 0 });

const EXECUTABLE_CANDIDATES = {
  ffmpeg: [
    process.env.FFMPEG_PATH,
    '/usr/local/bin/ffmpeg',
    '/usr/bin/ffmpeg',
    '/opt/homebrew/bin/ffmpeg',
  ],
  ffprobe: [
    process.env.FFPROBE_PATH,
    '/usr/local/bin/ffprobe',
    '/usr/bin/ffprobe',
    '/opt/homebrew/bin/ffprobe',
  ],
};

let canProcessVideoThumbnails = false;

const resolveExecutable = (candidates = []) => {
  for (const candidate of candidates) {
    if (!candidate) continue;

    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch (error) {
      // try next candidate
    }
  }

  return null;
};

const configureFfmpegBinaries = () => {
  const ffmpegPath = resolveExecutable(EXECUTABLE_CANDIDATES.ffmpeg);
  if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
  } else {
    logger.warn('FFmpeg binary not found. Video thumbnails will be skipped.');
  }

  const ffprobePath = resolveExecutable(EXECUTABLE_CANDIDATES.ffprobe);
  if (ffprobePath) {
    ffmpeg.setFfprobePath(ffprobePath);
  } else {
    logger.warn('ffprobe binary not found. Video thumbnails will be skipped.');
  }

  canProcessVideoThumbnails = Boolean(ffmpegPath && ffprobePath);
};

configureFfmpegBinaries();

const isImage = (ext) => extensions.images.includes(ext);
const isVideo = (ext) => extensions.videos.includes(ext);
const isPdf = (ext) => ext === 'pdf';

const inflight = new Map();

const hashForFile = async (filePath) => {
  const info = await fsPromises.stat(filePath);
  const hash = crypto.createHash('sha1');
  hash.update(filePath);
  hash.update(String(info.size));
  hash.update(String(Math.floor(info.mtimeMs)));
  return hash.digest('hex');
};

const atomicWrite = async (finalPath, buffer) => {
  await ensureDir(path.dirname(finalPath));
  const tmpPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`;
  await fsPromises.writeFile(tmpPath, buffer);
  await fsPromises.rename(tmpPath, finalPath);
};

const makeImageThumb = async (srcPath, destPath) => {
  const { size, quality } = await getThumbOptions();
  const buffer = await sharp(srcPath)
    .resize({
      width: size,
      height: size,
      fit: 'inside',
      withoutEnlargement: true,
      fastShrinkOnLoad: true,
    })
    .webp({ quality, effort: 4 })
    .toBuffer();

  await atomicWrite(destPath, buffer);
};

const probeDuration = (filePath) =>
  new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (error, data) => {
      if (error || !data?.format?.duration) {
        resolve(null);
        return;
      }

      resolve(Number(data.format.duration) || null);
    });
  });

const makeVideoThumb = async (srcPath, destPath) => {
  if (!canProcessVideoThumbnails) {
    logger.warn({ srcPath }, 'Skipping video thumbnail (no ffmpeg/ffprobe)');
    return;
  }

  const duration = await probeDuration(srcPath);
  const seconds = duration && Number.isFinite(duration)
    ? Math.max(1, Math.floor(duration * 0.05))
    : 1;

  await new Promise((resolve, reject) => {
    // Size is dynamic; capture inside ffmpeg filter
    let size = 200;
    getThumbOptions().then(({ size: sz }) => { size = sz; }).catch(() => {});
    const command = ffmpeg(srcPath)
      .inputOptions(['-hide_banner', '-loglevel', 'error'])
      .seekInput(seconds)
      .outputOptions(['-frames:v', '1', '-vf', `scale=${size}:-1:flags=lanczos`, '-vcodec', 'png'])
      .format('image2pipe')
      .on('error', reject);

    const stream = command.pipe();
    stream.on('error', reject);

    (async () => {
      const { quality } = await getThumbOptions();
      const pipeline = sharp().webp({ quality, effort: 4 });
      stream.pipe(pipeline);
      pipeline
        .toBuffer()
        .then((buffer) => atomicWrite(destPath, buffer))
        .then(resolve)
        .catch(reject);
    })().catch(reject);
  });
};

const generateThumbnail = async (filePath, thumbPath) => {
  const extension = path.extname(filePath).toLowerCase().slice(1);

  if (isPdf(extension)) {
    return;
  }

  if (isImage(extension)) {
    await makeImageThumb(filePath, thumbPath);
    return;
  }

  if (isVideo(extension)) {
    await makeVideoThumb(filePath, thumbPath);
    return;
  }

  throw new Error(`Unsupported file type: .${extension}`);
};

const buildThumbnailPaths = async (filePath) => {
  const key = await hashForFile(filePath);
  const thumbFile = `${key}.webp`;
  const thumbPath = path.join(directories.thumbnails, thumbFile);
  return { thumbFile, thumbPath };
};

const getThumbnailPathIfExists = async (filePath) => {
  if (filePath.includes(directories.thumbnails)) {
    return '';
  }

  const extension = path.extname(filePath).toLowerCase().slice(1);
  if (isPdf(extension)) {
    return '';
  }

  const { thumbFile, thumbPath } = await buildThumbnailPaths(filePath);

  try {
    await fsPromises.access(thumbPath, fs.constants.F_OK);
    return `/static/thumbnails/${thumbFile}`;
  } catch (error) {
    return '';
  }
};

const getThumbnail = async (filePath) => {
  if (filePath.includes(directories.thumbnails)) {
    return '';
  }

  const extension = path.extname(filePath).toLowerCase().slice(1);
  if (isPdf(extension)) {
    return '';
  }

  const { thumbFile, thumbPath } = await buildThumbnailPaths(filePath);

  const createOrReuse = async () => {
    try {
      await fsPromises.access(thumbPath, fs.constants.F_OK);
      return `/static/thumbnails/${thumbFile}`;
    } catch (error) {
      await generateThumbnail(filePath, thumbPath);

      try {
        await fsPromises.access(thumbPath, fs.constants.F_OK);
        return `/static/thumbnails/${thumbFile}`;
      } catch (missing) {
        return '';
      }
    }
  };

  let pending = inflight.get(thumbPath);
  if (!pending) {
    pending = createOrReuse().finally(() => inflight.delete(thumbPath));
    inflight.set(thumbPath, pending);
  }

  return pending;
};

const queueThumbnailGeneration = (filePath) => {
  if (!filePath || filePath.includes(directories.thumbnails)) {
    return;
  }

  const extension = path.extname(filePath).toLowerCase().slice(1);
  if (isPdf(extension)) {
    return;
  }

  getThumbnail(filePath).catch((error) => {
    logger.warn({ filePath, err: error }, 'Queued thumbnail generation failed');
  });
};

module.exports = {
  generateThumbnail,
  getThumbnail,
  getThumbnailPathIfExists,
  queueThumbnailGeneration,
};

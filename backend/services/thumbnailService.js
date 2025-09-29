const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');

const fsPromises = fs.promises;

const { ensureDir } = require('../utils/fsUtils');
const { directories, extensions, thumbnails } = require('../config/index');

const THUMB_SIZE = typeof thumbnails?.size === 'number' ? thumbnails.size : 200;
const THUMB_QUALITY = typeof thumbnails?.quality === 'number' ? thumbnails.quality : 70;

const currentConcurrency = sharp.concurrency();
sharp.concurrency(Math.max(1, Math.min(8, currentConcurrency)));
sharp.cache({ memory: 256, files: 0 });

const supportsPdfInput = Boolean(sharp.format?.pdf?.input);

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
    console.warn('FFmpeg binary not found. Video thumbnails will be skipped.');
  }

  const ffprobePath = resolveExecutable(EXECUTABLE_CANDIDATES.ffprobe);
  if (ffprobePath) {
    ffmpeg.setFfprobePath(ffprobePath);
  } else {
    console.warn('ffprobe binary not found. Video thumbnails will be skipped.');
  }

  canProcessVideoThumbnails = Boolean(ffmpegPath && ffprobePath);
};

configureFfmpegBinaries();

const isImage = (ext) => extensions.images.includes(ext);
const isVideo = (ext) => extensions.videos.includes(ext);
const isDocument = (ext) => extensions.documents.includes(ext);

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
  const buffer = await sharp(srcPath)
    .resize({
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      fit: 'inside',
      withoutEnlargement: true,
      fastShrinkOnLoad: true,
    })
    .webp({ quality: THUMB_QUALITY, effort: 4 })
    .toBuffer();

  await atomicWrite(destPath, buffer);
};

const makePdfThumb = async (srcPath, destPath) => {
  if (!supportsPdfInput) {
    console.warn(`Skipping PDF thumbnail (sharp built without PDF support): ${srcPath}`);
    return;
  }

  try {
    const buffer = await sharp(srcPath, { density: 200 })
      .resize({
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        fit: 'inside',
        withoutEnlargement: true,
        fastShrinkOnLoad: true,
      })
      .webp({ quality: THUMB_QUALITY, effort: 4 })
      .toBuffer();

    await atomicWrite(destPath, buffer);
  } catch (error) {
    console.warn(`Failed to generate PDF thumbnail for ${srcPath}: ${error.message}`);
  }
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
    console.warn(`Skipping video thumbnail (no ffmpeg/ffprobe): ${srcPath}`);
    return;
  }

  const duration = await probeDuration(srcPath);
  const seconds = duration && Number.isFinite(duration)
    ? Math.max(1, Math.floor(duration * 0.05))
    : 1;

  await new Promise((resolve, reject) => {
    const command = ffmpeg(srcPath)
      .inputOptions(['-hide_banner', '-loglevel', 'error'])
      .seekInput(seconds)
      .outputOptions(['-frames:v', '1', '-vf', `scale=${THUMB_SIZE}:-1:flags=lanczos`, '-vcodec', 'png'])
      .format('image2pipe')
      .on('error', reject);

    const stream = command.pipe();
    stream.on('error', reject);

    const pipeline = sharp().webp({ quality: THUMB_QUALITY, effort: 4 });
    stream.pipe(pipeline);

    pipeline
      .toBuffer()
      .then((buffer) => atomicWrite(destPath, buffer))
      .then(resolve)
      .catch(reject);
  });
};

const generateThumbnail = async (filePath, thumbPath) => {
  const extension = path.extname(filePath).toLowerCase().slice(1);

  if (isImage(extension)) {
    await makeImageThumb(filePath, thumbPath);
    return;
  }

  if (isVideo(extension)) {
    await makeVideoThumb(filePath, thumbPath);
    return;
  }

  if (isDocument(extension)) {
    await makePdfThumb(filePath, thumbPath);
    return;
  }

  throw new Error(`Unsupported file type: .${extension}`);
};

const getThumbnail = async (filePath) => {
  if (filePath.includes(directories.thumbnails)) {
    return '';
  }

  const key = await hashForFile(filePath);
  const thumbFile = `${key}.webp`;
  const thumbPath = path.join(directories.thumbnails, thumbFile);

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

module.exports = {
  generateThumbnail,
  getThumbnail,
};

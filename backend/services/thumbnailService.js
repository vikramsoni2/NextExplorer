const path = require('path');
const crypto = require('crypto');
const fss = require('fs');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');

const { ensureDir } = require('../utils/fsUtils');
const { directories, extensions } = require('../config/index');

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
    if (!candidate) {
      continue;
    }

    try {
      fss.accessSync(candidate, fss.constants.X_OK);
      return candidate;
    } catch (error) {
      // Try the next candidate
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

const generateThumbnail = async (filePath, thumbPath) => {
  await ensureDir(path.dirname(thumbPath));

  const extension = path.extname(filePath).split('.').splice(-1)[0].toLowerCase();

  if (extensions.images.includes(extension)) {
    await sharp(filePath)
      .resize(200)
      .toFile(thumbPath);
    return;
  }

  if (extensions.videos.includes(extension)) {
    if (!canProcessVideoThumbnails) {
      console.warn(`Skipping video thumbnail generation because ffmpeg/ffprobe binaries are unavailable: ${filePath}`);
      return;
    }

    await new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .screenshots({
          timestamps: ['5%'],
          filename: path.basename(thumbPath),
          folder: path.dirname(thumbPath),
          size: '200x?'
        })
        .on('end', resolve)
        .on('error', reject);
    });
    return;
  }

  throw new Error('Unsupported file type');
};

const getThumbnail = async (filePath) => {
  if (filePath.includes(directories.thumbnails)) {
    return '';
  }

  const thumbFile = `${crypto.createHash('sha1').update(filePath).digest('hex')}.png`;
  const thumbPath = path.join(directories.thumbnails, thumbFile);

  if (!fss.existsSync(thumbPath)) {
    await generateThumbnail(filePath, thumbPath);
  }

  return `/static/thumbnails/${thumbFile}`;
};

module.exports = {
  generateThumbnail,
  getThumbnail,
};

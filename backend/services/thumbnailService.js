const path = require('path');
const crypto = require('crypto');
const fss = require('fs');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');

const { ensureDir } = require('../utils/fsUtils');
const { directories, extensions } = require('../config/index');

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

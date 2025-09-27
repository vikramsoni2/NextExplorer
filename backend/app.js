const fss = require('fs');
const path = require('path');
const cors = require('cors');
const sharp = require('sharp');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs').promises;
const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const WebSocket = require('ws');
// const pty = require('node-pty');

const port = Number(process.env.PORT) || 3000;
const volumeDir = path.resolve(process.env.VOLUME_ROOT || '/mnt');
const volumeDirWithSep = volumeDir.endsWith(path.sep) ? volumeDir : `${volumeDir}${path.sep}`;
const cacheDir = path.resolve(process.env.CACHE_DIR || '/cache');
const thumbnailDir = path.join(cacheDir, 'thumbnails');
const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tif', 'tiff', 'avif', 'heic'];
const videoExtensions = ['mp4', 'mov', 'mkv', 'webm', 'm4v', 'avi', 'wmv', 'flv', 'mpg', 'mpeg'];
const excludedFiles = ['thumbs.db', '.DS_Store'];

const mimeTypes = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  avif: 'image/avif',
  heic: 'image/heic',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  m4v: 'video/x-m4v',
  avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
};

const previewableExtensions = new Set([...imageExtensions, ...videoExtensions]);

const ensureDir = async (targetPath) => {
  await fs.mkdir(targetPath, { recursive: true });
};

const pathExists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    return false;
  }
};

const normalizeRelativePath = (relativePath = '') => {
  if (!relativePath || relativePath === '/') {
    return '';
  }

  const normalized = path
    .normalize(relativePath.replace(/\\/g, '/'))
    .replace(/^[\\/]+/, '');

  if (normalized === '.' ) {
    return '';
  }

  if (normalized === '..' || normalized.startsWith('..' + path.sep)) {
    throw new Error('Invalid path. Traversal outside the volume root is not allowed.');
  }

  return normalized;
};

const resolveVolumePath = (relativePath = '') => {
  const safeRelativePath = normalizeRelativePath(relativePath);
  const absolutePath = path.resolve(volumeDir, safeRelativePath);

  if (absolutePath !== volumeDir && !absolutePath.startsWith(volumeDirWithSep)) {
    throw new Error('Resolved path is outside the configured volume root.');
  }

  return absolutePath;
};

const readMetaField = (req, key, fallback = '') => {
  if (!req || !req.body) return fallback;

  if (typeof req.body[key] === 'string') {
    return req.body[key];
  }

  const bracketKey = `meta[${key}]`;
  const bracketValue = req.body[bracketKey];
  if (typeof bracketValue === 'string') {
    return bracketValue;
  }

  return fallback;
};

const splitName = (name) => {
  const extension = path.extname(name);
  const base = extension ? name.slice(0, -extension.length) : name;
  return { base, extension };
};

const findAvailableName = async (directory, desiredName) => {
  let candidate = desiredName;
  let counter = 1;

  while (await pathExists(path.join(directory, candidate))) {
    const { base, extension } = splitName(desiredName);
    candidate = `${base} (${counter})${extension}`;
    counter += 1;
  }

  return candidate;
};

const combineRelativePath = (parent = '', name = '') => {
  const normalizedParent = normalizeRelativePath(parent);
  const combined = path.posix.join(normalizedParent, name);
  return normalizeRelativePath(combined);
};

const copyEntry = async (sourcePath, destinationPath, isDirectory) => {
  if (isDirectory) {
    if (typeof fs.cp === 'function') {
      await fs.cp(sourcePath, destinationPath, {
        recursive: true,
        force: false,
        errorOnExist: true,
      });
    } else {
      await fs.mkdir(destinationPath, { recursive: true });
      const entries = await fs.readdir(sourcePath, { withFileTypes: true });
      for (const entry of entries) {
        const src = path.join(sourcePath, entry.name);
        const dest = path.join(destinationPath, entry.name);
        // eslint-disable-next-line no-await-in-loop
        await copyEntry(src, dest, entry.isDirectory());
      }
    }
  } else {
    await fs.copyFile(sourcePath, destinationPath);
  }
};

const moveEntry = async (sourcePath, destinationPath, isDirectory) => {
  try {
    await fs.rename(sourcePath, destinationPath);
  } catch (error) {
    if (error.code === 'EXDEV') {
      await copyEntry(sourcePath, destinationPath, isDirectory);
      await fs.rm(sourcePath, { recursive: isDirectory, force: true });
    } else {
      throw error;
    }
  }
};

const resolveItemPaths = (item = {}) => {
  if (!item || typeof item.name !== 'string') {
    throw new Error('Each item must include a name.');
  }

  const parentPath = item.path || '';
  const relativePath = combineRelativePath(parentPath, item.name);
  const absolutePath = resolveVolumePath(relativePath);

  return { relativePath, absolutePath };
};

(async () => {
  try {
    await ensureDir(cacheDir);
    await ensureDir(thumbnailDir);
  } catch (error) {
    console.error('Failed to initialize cache directories:', error);
  }
})();

// const volumeDir = '/Users/vikram/Downloads/vols';
// const cacheDir = '/Users/vikram/Downloads/cache'
// const thumbnailDir = '/Users/vikram/Downloads/cache/thumbnails'



async function generateThumbnail(filePath, thumbPath) {
  if (!fss.existsSync(path.dirname(thumbPath))) {
    await ensureDir(path.dirname(thumbPath));
  }

  const extension = path.extname(filePath).split(".").splice(-1)[0].toLowerCase();
  if (imageExtensions.includes(extension)) {
    // Generate image thumbnail
    await sharp(filePath)
      .resize(200)
      .toFile(thumbPath);
  } else if (videoExtensions.includes(extension)) {
    // Generate video thumbnail
    await new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .screenshots({
          timestamps: ['5%'], // Capture thumbnail from the middle of the video
          filename: path.basename(thumbPath),
          folder: path.dirname(thumbPath),
          size: '200x?'
        })
        .on('end', resolve)
        .on('error', reject);
    });
  } else {
    throw new Error('Unsupported file type');
  }
}

// const thumbnailQueue = [];

// async function processQueue() {
//   while (true) {
//     if (thumbnailQueue.length > 0) {
//       const { filePath, thumbPath } = thumbnailQueue.shift();
//       try {
//         await generateThumbnail(filePath, thumbPath);
//         console.log(`Thumbnail generated for ${filePath}`);
//       } catch (err) {
//         console.error(`Failed to generate thumbnail for ${filePath}:`, err);
//       }
//     } else {
//       await new Promise(resolve => setTimeout(resolve, 1000)); // Sleep for 1 second
//     }
//   }
// }

// processQueue(); 




const corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

const app = express();

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});
 
// const upload = multer({ dest: 'uploads/' })


function CustomStorage(opts) {
  this.getDestination = opts.destination || function (req, file, cb) {
    cb(null, '/uploads/');
  };
}

CustomStorage.prototype._handleFile = function (req, file, cb) {
  this.getDestination(req, file, async (err) => {
    if (err) {
      console.error('Error in getDestination:', err);
      return cb(err);
    }

    try {
      const relativePathMeta = readMetaField(req, 'relativePath');
      const uploadToMeta = readMetaField(req, 'uploadTo');

      const uploadTo = normalizeRelativePath(uploadToMeta);
      const relativePath = normalizeRelativePath(relativePathMeta) || path.basename(file.originalname);

      const destinationRoot = resolveVolumePath(uploadTo);
      const destinationPath = path.join(destinationRoot, relativePath);
      const destinationDir = path.dirname(destinationPath);
      const tempPath = `${destinationPath}.download`;

      await ensureDir(destinationDir);

      const outStream = fss.createWriteStream(tempPath);
      file.stream.pipe(outStream);

      outStream.on('error', async (streamErr) => {
        console.error('Error during file streaming:', streamErr);
        try {
          if (await pathExists(tempPath)) {
            await fs.rm(tempPath, { force: true });
          }
        } catch (cleanupErr) {
          console.error('Failed to remove temporary upload file:', cleanupErr);
        }
        cb(streamErr);
      });

      outStream.on('finish', async () => {
        try {
          await fs.rename(tempPath, destinationPath);
          cb(null, {
            path: destinationPath,
            size: outStream.bytesWritten,
          });
        } catch (renameErr) {
          console.error('Error during file renaming:', renameErr);
          cb(renameErr);
        }
      });
    } catch (uploadError) {
      console.error('Error during file upload:', uploadError);
      cb(uploadError);
    }
  });
};

CustomStorage.prototype._removeFile = function (req, file, cb) {
  fs.unlink(file.path, cb);
};

const customStorage = (opts) => new CustomStorage(opts);

const upload = multer({ storage: customStorage({}) });


app.post('/api/upload', upload.fields([{ name: 'filedata', maxCount: 50 }]), async (req, res) => {
  try {
    if (!req.files || !Array.isArray(req.files.filedata) || req.files.filedata.length === 0) {
      return res.status(400).json({ error: 'No files were provided.' });
    }

    const fileData = [];
    for (const file of req.files.filedata) {
      const filePath = file.path;
      const stats = await fs.stat(filePath);
      const relativeFilePath = normalizeRelativePath(path.relative(volumeDir, filePath));
      const parentPath = normalizeRelativePath(path.dirname(relativeFilePath));
      const extension = path.extname(file.originalname).toLowerCase().replace('.', '');
      const item = {
        name: file.originalname,
        path: parentPath,
        dateModified: stats.mtime,
        size: stats.size,
        kind: extension
      };
      fileData.push(item);
      console.log("File uploaded to:", filePath);
    }
    res.json(fileData);
  } catch (err) {
    console.error(`Error: ${err}`);
    res.status(500).send('Server error');
  }
});

const handleFileTransfer = async (items, destination, operation) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one item is required.');
  }

  const destinationRelative = normalizeRelativePath(destination);
  const destinationAbsolute = resolveVolumePath(destinationRelative);
  await ensureDir(destinationAbsolute);

  const results = [];

  for (const item of items) {
    const { relativePath: sourceRelative, absolutePath: sourceAbsolute } = resolveItemPaths(item);
    if (!(await pathExists(sourceAbsolute))) {
      throw new Error(`Source path not found: ${sourceRelative}`);
    }

    const stats = await fs.stat(sourceAbsolute);
    const sourceParent = normalizeRelativePath(path.dirname(sourceRelative));

    if (operation === 'move' && destinationRelative === sourceParent) {
      results.push({ from: sourceRelative, to: sourceRelative, skipped: true });
      continue;
    }

    const desiredName = item.newName || item.name;
    const availableName = await findAvailableName(destinationAbsolute, desiredName);
    const targetAbsolute = path.join(destinationAbsolute, availableName);
    const targetRelative = combineRelativePath(destinationRelative, availableName);

    if (operation === 'copy') {
      await copyEntry(sourceAbsolute, targetAbsolute, stats.isDirectory());
    } else if (operation === 'move') {
      await moveEntry(sourceAbsolute, targetAbsolute, stats.isDirectory());
    } else {
      throw new Error(`Unsupported operation: ${operation}`);
    }

    results.push({ from: sourceRelative, to: targetRelative });
  }

  return { destination: destinationRelative, items: results };
};

app.post('/api/files/copy', async (req, res) => {
  try {
    const { items = [], destination = '' } = req.body || {};
    const result = await handleFileTransfer(items, destination, 'copy');
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Copy operation failed:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/files/move', async (req, res) => {
  try {
    const { items = [], destination = '' } = req.body || {};
    const result = await handleFileTransfer(items, destination, 'move');
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Move operation failed:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

app.delete('/api/files', async (req, res) => {
  try {
    const { items = [] } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one item is required.' });
    }

    const results = [];

    for (const item of items) {
      const { relativePath, absolutePath } = resolveItemPaths(item);
      if (!(await pathExists(absolutePath))) {
        results.push({ path: relativePath, status: 'missing' });
        continue;
      }

      const stats = await fs.stat(absolutePath);
      await fs.rm(absolutePath, { recursive: stats.isDirectory(), force: true });
      results.push({ path: relativePath, status: 'deleted' });
    }

    res.json({ success: true, items: results });
  } catch (error) {
    console.error('Delete operation failed:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/download', async (req, res) => {
  try {
    const { path: relative = '' } = req.query;
    if (typeof relative !== 'string' || !relative) {
      return res.status(400).json({ error: 'A file path is required.' });
    }

    const relativePath = normalizeRelativePath(relative);
    const absolutePath = resolveVolumePath(relativePath);
    const stats = await fs.stat(absolutePath);

    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Downloading directories is not supported yet.' });
    }

    res.download(absolutePath, path.basename(absolutePath), (err) => {
      if (err) {
        console.error('Download failed:', err);
        if (!res.headersSent) {
          res.status(500).send('Failed to download file.');
        }
      }
    });
  } catch (error) {
    console.error('Download request failed:', error);
    res.status(400).json({ error: error.message });
  }
});


app.get('/api/preview', async (req, res) => {
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

    if (!previewableExtensions.has(extension)) {
      return res.status(415).json({ error: 'Preview is not available for this file type.' });
    }

    const mimeType = mimeTypes[extension] || 'application/octet-stream';
    const isVideo = videoExtensions.includes(extension);

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


// app.post('/api/upload', upload.fields([{ name: 'filedata', maxCount: 50 }]), async function (req, res) {
//   try {
//     for (const file of req.files.filedata) {
//       const relativePath = req.body.relativePath;
//       const uploadTo = path.join(volumeDir, req.body.uploadTo);
//       let destinationPath;

//       if (relativePath.includes('/')) {
//         destinationPath = path.join(uploadTo, relativePath);
//       } else {
//         destinationPath = path.join(uploadTo, path.basename(relativePath));
//       }

//       console.log("file: ", file);
//       console.log("destinationPath: ", destinationPath);

//       const destinationDir = path.dirname(destinationPath);

//       // Ensure the destination directory exists
//       await fs.mkdir(destinationDir, { recursive: true });

//       // Move the file to the destination
//       const tmpPath = file.path;
//       console.log(`moving file from ${tmpPath} to ${destinationPath}`);

//       await fs.copyFile(tmpPath, destinationPath);
//       await fs.unlink(tmpPath);

//       console.log(`File moved to ${destinationPath}`);
//     }

//     res.send('Files uploaded successfully');
//   } catch (err) {
//     console.error(`Error: ${err}`);
//     res.status(500).send('Server error');
//   }
// });



// app.post('/api/upload', upload.fields([{ name: 'filedata', maxCount: 50 }]), function (req, res) {
  
//   req.files.filedata.forEach(file => {
//     const relativePath = req.body.relativePath;
//     const uploadTo = path.join(volumeDir, req.body.uploadTo);
//     let destinationPath;

//     if (relativePath.includes('/')) {
//       destinationPath = path.join(uploadTo, relativePath);
//     } else {
//       destinationPath = path.join(uploadTo, path.basename(relativePath));
//     }

//     console.log("file: ", file)
//     console.log("destinationPath: ", destinationPath)


//     const destinationDir = path.dirname(destinationPath);

//     // Ensure the destination directory exists
//     fs.mkdir(destinationDir, { recursive: true }, (err) => {
//       if (err) {
//         console.error(`Error creating directory: ${err}`);
//         return res.status(500).send('Server error');
//       }

//       // Move the file to the destination
//       const tmpPath = file.path;
//       console.log(`movinf file from ${tmpPath} to ${destinationPath}`)

//       fs.rename(tmpPath, destinationPath, (err) => {
//         if (err) {
//           console.error(`Error moving file: ${err}`);
//           return res.status(500).send('Server error');
//         }

//         console.log(`File moved to ${destinationPath}`);
//       });
//     });
    
//   });

//   res.send('Files uploaded successfully');
    
// });




app.get('/api/volumes', async (req, res) => {
  try {
    const entries = await fs.readdir(volumeDir, { withFileTypes: true });

    const volumeData = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !excludedFiles.includes(name))
      .map((name) => ({
        name,
        path: name,
        kind: 'volume',
      }));

    res.json(volumeData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred while fetching the volumes.' });
  }
});




async function getThumbnail(filePath){
  // if the filePath in in thumbnailDir
  // then just return the path to original file and do not create thumbnail
  if(filePath.includes(thumbnailDir)){
    return ''
  }

  const thumbFile = crypto.createHash('sha1').update(filePath).digest('hex') + '.png'
  const thumbPath = path.join(thumbnailDir, thumbFile)
    
  if(!fss.existsSync(thumbPath)){
    await generateThumbnail(filePath, thumbPath)
  }
  return "/static/thumbnails/"+thumbFile
} 


app.get('/api/browse/*', async (req, res) => {
  try {
    const relativePath = normalizeRelativePath(req.params[0]);
    const directoryPath = resolveVolumePath(relativePath);

    if (!(await pathExists(directoryPath))) {
      return res.status(404).json({ error: 'Path not found.' });
    }

    const files = await fs.readdir(directoryPath);
    const filteredFiles = files
    .filter((file) => !excludedFiles.includes(file))
    .filter(file => path.extname(file).toLowerCase() !== '.download');

    const fileDataPromises =  filteredFiles.map(async (file) => {
      const filePath = path.join(directoryPath, file);
      const stats = await fs.stat(filePath);

      let extension = stats.isDirectory()? 'directory' : path.extname(file).slice(1).toLowerCase();
      if(extension.length > 10) extension='unknown'

      let item = {
        name: file,
        path: relativePath,
        dateModified: stats.mtime,
        size: stats.size,
        kind: extension
      }

      if (stats.isFile() && 
      [...imageExtensions, ...videoExtensions].includes(extension.toLowerCase())) {
        try {
          item.thumbnail = await getThumbnail(filePath)
        } catch (err) {
          console.log(`Failed to generate thumbnail for ${filePath}: Continuing`, err);
        }
      }
      return item;
    });
    
    const fileData = await Promise.all(fileDataPromises);
    res.json(fileData);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred while reading the directory.' });
  }
});


app.post('/api/editor', async (req, res) => {
  try {
    const { path: relative = '' } = req.body || {};
    if (typeof relative !== 'string' || !relative) {
      return res.status(400).json({ error: 'A valid file path is required.' });
    }

    const relativePath = normalizeRelativePath(relative);
    const absolutePath = resolveVolumePath(relativePath);
    const stats = await fs.stat(absolutePath);

    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Cannot open a directory in the editor.' });
    }

    const data = await fs.readFile(absolutePath, { encoding: 'utf-8' });
    res.send({ content: data });
  } catch (err) {
    console.error('Error reading the file:', err);
    res.status(500).json({ error: 'Failed to read file.' });
  }
});


app.put('/api/editor', async (req, res) => {
  try {
    const { path: relative = '', content = '' } = req.body || {};
    if (typeof relative !== 'string' || !relative) {
      return res.status(400).json({ error: 'A valid file path is required.' });
    }

    const relativePath = normalizeRelativePath(relative);
    const absolutePath = resolveVolumePath(relativePath);
    await ensureDir(path.dirname(absolutePath));
    await fs.writeFile(absolutePath, content, { encoding: 'utf-8' });
    res.send({ success: true });
  } catch (err) {
    console.error('Error writing to the file:', err);
    res.status(500).json({ error: 'Failed to update file.' });
  }
});


app.use('/static/thumbnails', express.static(thumbnailDir));



const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});

// const wss = new WebSocket.Server({ server, path: '/terminal' });

// wss.on('connection', (ws) => {
//   const shell = process.env.SHELL || 'bash';
//   const ptyProcess = pty.spawn(shell, [], {
//     name: 'xterm-color',
//     cols: 80,
//     rows: 30,
//     cwd: process.env.HOME,
//     env: process.env
//   });

//   ptyProcess.on('data', (data) => {
//     ws.send(data);
//   });

//   ws.on('message', (message) => {
//     ptyProcess.write(message);
//   });

//   ws.on('close', () => {
//     ptyProcess.kill();
//   });
// });

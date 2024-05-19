const fss = require('fs');
const path = require('path');
const cors = require('cors'); 
const sharp = require('sharp');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs').promises;
const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const bodyParser = require('body-parser');



const port = 3000; 
const cacheDir = '/cache'
const thumbnailDir = '/cache/thumbnails'
const imageExtensions = ['jpg', 'jpeg', 'png', 'gif']
const videoExtensions = ['mp4', 'avi', 'mov', 'mkv']






async function generateThumbnail(filePath, thumbPath) {
  const extension = path.extname(filePath).split(".").splice(-1)[0].toLowerCase();

  console.log(extension)
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
  methods: ['GET', 'PUT', 'UPDATE', 'DELETE']  
};

const app = express();

app.use(cors(corsOptions));
app.use(bodyParser.json());
 
// const upload = multer({ dest: 'uploads/' })


function CustomStorage(opts) {
  this.getDestination = opts.destination || function (req, file, cb) {
    cb(null, '/uploads/');
  };
}

CustomStorage.prototype._handleFile = function (req, file, cb) {
  this.getDestination(req, file, async (err, destination) => {
    if (err) {
      console.error("Error in getDestination:", err);
      return cb(err);
    }

    const relativePath = path.normalize(req.body.relativePath);
    const uploadTo = path.join("/mnt/", path.normalize(req.body.uploadTo));
    let destinationPath;

    if (relativePath.includes('/')) {
      destinationPath = path.join(uploadTo, relativePath);
    } else {
      destinationPath = path.join(uploadTo, path.basename(relativePath));
    }

    const destinationDir = path.dirname(destinationPath);
    const tempPath = destinationPath + '.download';

    try {
      await fs.mkdir(destinationDir, { recursive: true });
      const outStream = fss.createWriteStream(tempPath);

      file.stream.pipe(outStream);
      outStream.on('error', (streamErr) => {
        console.error("Error during file streaming:", streamErr);
        cb(streamErr);
      });
      outStream.on('finish', async () => {
        try {
          await fs.rename(tempPath, destinationPath);
          cb(null, {
            path: destinationPath,
            size: outStream.bytesWritten
          });
        } catch (renameErr) {
          console.error("Error during file renaming:", renameErr);
          cb(renameErr);
        }
      });
    } catch (err) {
      console.error("Error during file upload:", err);
      cb(err);
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
    const fileData = [];
    for (const file of req.files.filedata) {
      const filePath = file.path;
      const stats = await fs.stat(filePath);
      const extension = path.extname(file.originalname).toLowerCase().replace('.', '');
      const item = {
        name: file.originalname,
        path: req.body.relativePath,
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


// app.post('/api/upload', upload.fields([{ name: 'filedata', maxCount: 50 }]), async function (req, res) {
//   try {
//     for (const file of req.files.filedata) {
//       const relativePath = req.body.relativePath;
//       const uploadTo = path.join("/mnt/", req.body.uploadTo);
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
//     const uploadTo = path.join("/mnt/", req.body.uploadTo);
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
    const directoryPath = '/mnt/';
    const volumes = await fs.readdir(directoryPath);
    const volumeData = volumes.map((volume) => {
      return {
        name: volume,
        path: volume,
        kind: 'volume',
      };
    });
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
  const directoryPath = `/mnt/${req.params[0]}`; 

  try {
    const files = await fs.readdir(directoryPath);
    const fileData = [];

    await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(directoryPath, file);
        const stats = await fs.stat(filePath);

        let extension = stats.isDirectory()? 'directory' : file.split(".").splice(-1)[0]
        if(extension.length > 10) extension='unknown'

        let item = {
          name: file,
          path: req.params[0], 
          dateModified: stats.mtime,
          size: stats.size,
          kind: extension
        }

        if (stats.isFile() && 
        [...imageExtensions, ...videoExtensions].includes(extension.toLowerCase())) {
          item.thumbnail = await getThumbnail(filePath)
        }
        
        fileData.push(item);
      })
    );

    res.json(fileData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred while reading the directory.' });
  }
});




app.get('/api/file/:path', (req, res) => {
  const filePath = "/mnt/"+req.params.path
  console.log("hitting file endpoint")
  console.log(filePath)

  fs.readFile(filePath, { encoding: 'utf-8' }, (err, data) => {
      if (err) {
          console.error('Error reading the file:', err);
          return res.status(500).send('Failed to read file.');
      }
      res.send(data);
  });
});


app.post('/api/editor', async (req, res) => {
  const basePath = "/mnt";
  const safeFilePath = path.join(basePath, req.body.path.replace(/\.\./g, ''));

  try {
    const data = await fs.readFile(safeFilePath, { encoding: 'utf-8' });
    console.log(data);
    res.send({ content: data });
  } catch (err) {
    console.error('Error reading the file:', err);
    res.status(500).json({ error: 'Failed to read file.' });
  }
});


app.put('/api/editor', (req, res) => {
  const filePath = "/mnt/"+ request.body.path
  const content = req.body.content; // Assuming the new content is passed as a JSON payload

  fs.writeFile(filePath, content, (err) => {
      if (err) {
          console.error('Error writing to the file:', err);
          return res.status(500).send('Failed to update file.');
      }
      res.send('File updated successfully.');
  });
});


app.use('/static/thumbnails', express.static('/cache/thumbnails'));



app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});

// Start the queue processor


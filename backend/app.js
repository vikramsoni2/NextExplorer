const express = require('express');
const cors = require('cors');

const { port, directories, corsOptions } = require('./config/index');
const { ensureDir } = require('./utils/fsUtils');
const registerRoutes = require('./routes');
const authRoutes = require('./routes/auth');
const authMiddleware = require('./middleware/authMiddleware');
const { initializeAuth } = require('./services/authService');

const app = express();

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

(async () => {
  try {
    await ensureDir(directories.cache);
    await ensureDir(directories.thumbnails);
    await initializeAuth();
  } catch (error) {
    console.error('Failed to initialize application:', error);
  }
})();

app.use('/api/auth', authRoutes);
app.use(authMiddleware);

app.use('/static/thumbnails', express.static(directories.thumbnails));

registerRoutes(app);

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = {
  app,
  server,
};

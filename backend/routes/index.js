const uploadRoutes = require('./upload');
const fileRoutes = require('./files');
const browseRoutes = require('./browse');
const thumbnailRoutes = require('./thumbnails');
const editorRoutes = require('./editor');
const volumeRoutes = require('./volumes');
const favoritesRoutes = require('./favorites');
const settingsRoutes = require('./settings');
const searchRoutes = require('./search');
const usersRoutes = require('./users');

const registerRoutes = (app) => {
  app.use('/api', uploadRoutes);
  app.use('/api', fileRoutes);
  app.use('/api', browseRoutes);
  app.use('/api', editorRoutes);
  app.use('/api', volumeRoutes);
  app.use('/api', favoritesRoutes);
  app.use('/api', settingsRoutes);
  app.use('/api', thumbnailRoutes);
  app.use('/api', searchRoutes);
  app.use('/api', usersRoutes);
};

module.exports = registerRoutes;

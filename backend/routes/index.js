const authRoutes = require('./auth');
const uploadRoutes = require('./upload');
const fileRoutes = require('./files');
const browseRoutes = require('./browse');
const thumbnailRoutes = require('./thumbnails');
const editorRoutes = require('./editor');
const volumeRoutes = require('./volumes');
const usageRoutes = require('./usage');
const favoritesRoutes = require('./favorites');
const settingsRoutes = require('./settings');
const searchRoutes = require('./search');
const usersRoutes = require('./users');
const metadataRoutes = require('./metadata');
const onlyofficeRoutes = require('./onlyoffice');
const featuresRoutes = require('./features');
const { onlyoffice } = require('../config/index');

const registerRoutes = (app) => {
  app.use('/api/auth', authRoutes);
  app.use('/api', uploadRoutes);
  app.use('/api', fileRoutes);
  app.use('/api', browseRoutes);
  app.use('/api', editorRoutes);
  app.use('/api', volumeRoutes);
  app.use('/api', usageRoutes);
  app.use('/api', favoritesRoutes);
  app.use('/api', settingsRoutes);
  app.use('/api', thumbnailRoutes);
  app.use('/api', searchRoutes);
  app.use('/api', usersRoutes);
  app.use('/api', metadataRoutes);
  // Public features endpoint (always available)
  app.use('/api', featuresRoutes);
  // Mount ONLYOFFICE routes only when configured
  if (onlyoffice && onlyoffice.serverUrl) {
    app.use('/api', onlyofficeRoutes);
  }
};

module.exports = registerRoutes;

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
const collaboraRoutes = require('./collabora');
const featuresRoutes = require('./features');
const terminalRoutes = require('./terminal');
const permissionsRoutes = require('./permissions');
const sharesRoutes = require('./shares');
const zipRoutes = require('./zip');
const healthRoutes = require('./health');
const userVolumesRoutes = require('./userVolumes');
const { onlyoffice, collabora } = require('../config/index');

const registerRoutes = (app) => {
  // Health endpoints (no /api prefix, unauthenticated)
  app.use('/', healthRoutes);

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
  app.use('/api', permissionsRoutes);
  app.use('/api', zipRoutes);
  // User volumes management (admin only, requires USER_VOLUMES feature)
  app.use('/api', userVolumesRoutes);
  // Share routes (supports guest sessions)
  app.use('/api/shares', sharesRoutes);
  app.use('/api/share', sharesRoutes);
  // Public features endpoint (always available)
  app.use('/api', featuresRoutes);
  // Admin-only terminal session endpoint
  app.use('/api', terminalRoutes);
  // Mount ONLYOFFICE routes only when configured
  if (onlyoffice && onlyoffice.serverUrl) {
    app.use('/api', onlyofficeRoutes);
  }

  // Mount Collabora routes only when configured
  if (collabora && collabora.url && collabora.secret) {
    app.use('/api', collaboraRoutes);
  }
};

module.exports = registerRoutes;

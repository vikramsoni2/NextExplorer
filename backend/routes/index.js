const uploadRoutes = require('./upload');
const fileRoutes = require('./files');
const browseRoutes = require('./browse');
const editorRoutes = require('./editor');
const volumeRoutes = require('./volumes');

const registerRoutes = (app) => {
  app.use('/api', uploadRoutes);
  app.use('/api', fileRoutes);
  app.use('/api', browseRoutes);
  app.use('/api', editorRoutes);
  app.use('/api', volumeRoutes);
};

module.exports = registerRoutes;

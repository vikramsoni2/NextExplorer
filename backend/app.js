const express = require('express');
const session = require('express-session');

const { port } = require('./config/index');
const { configureTrustProxy } = require('./middleware/trustProxy');
const { configureHttpLogging } = require('./middleware/logging');
const { configureCors } = require('./middleware/cors');
const { configureOidc } = require('./middleware/oidc');
const { configureHttpsWarning } = require('./middleware/httpsWarning');
const authMiddleware = require('./middleware/authMiddleware');
const registerRoutes = require('./routes');
const { configureStaticFiles } = require('./utils/staticServer');
const { bootstrap } = require('./utils/bootstrap');
const { configureSession } = require('./middleware/session');
const logger = require('./utils/logger');

const app = express();
let server = null;

const initializeApp = async () => {
  logger.debug('Application initialization started');

  configureTrustProxy(app);
  configureHttpLogging(app);

  configureCors(app);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  await bootstrap();

  configureSession(app);
  await configureOidc(app);
  configureHttpsWarning(app);

  app.use(authMiddleware);
  logger.debug('Mounted auth middleware');
  registerRoutes(app);
  logger.debug('Registered application routes');

  configureStaticFiles(app);

  server = app.listen(port, '0.0.0.0', () => {
    logger.info({ port }, 'Server is running');
    logger.debug('HTTP server listen callback executed');
  });
};

initializeApp().catch((error) => {
  logger.error({ err: error }, 'Failed to initialize application');
  process.exit(1);
});

module.exports = {
  app,
  get server() {
    return server;
  },
};
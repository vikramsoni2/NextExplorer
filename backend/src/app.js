const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');

const { port, http } = require('./config/index');
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
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const terminalService = require('./services/terminalService');

const app = express();
let server = null;

const initializeApp = async () => {
  logger.debug('Application initialization started');

   configureTrustProxy(app);
   configureHttpLogging(app);

   configureCors(app);
   app.use(express.json());
   app.use(express.urlencoded({ extended: true }));
   app.use(cookieParser());
   logger.debug('Mounted cookie parser middleware');

  await bootstrap();

  configureSession(app);
  await configureOidc(app);
  configureHttpsWarning(app);

  app.use(authMiddleware);
  logger.debug('Mounted auth middleware');
  registerRoutes(app);
  logger.debug('Registered application routes');

  configureStaticFiles(app);

  // Error handling middleware (must be after all routes)
  app.use(notFoundHandler);
  app.use(errorHandler);
  logger.debug('Mounted error handling middleware');

  server = app.listen(port, '0.0.0.0', () => {
    logger.info({ port }, 'Server is running');
    logger.debug('HTTP server listen callback executed');
  });

  if (server && typeof server.requestTimeout === 'number') {
    server.requestTimeout = http?.requestTimeoutMs ?? server.requestTimeout;
    logger.info(
      { requestTimeoutMs: server.requestTimeout },
      'HTTP server request timeout configured'
    );
  }

  // Initialize WebSocket server for terminal
  terminalService.createWebSocketServer(server);
  logger.debug('Terminal WebSocket server initialized');

  // Cleanup on process termination
  const cleanup = () => {
    logger.info('Shutting down server...');
    terminalService.cleanup();
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
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

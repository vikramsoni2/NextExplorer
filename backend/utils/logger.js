const pino = require('pino');
const loggingConfig = require('../config/logging');

const logger = pino({
  level: loggingConfig.level,
  base: { service: 'nextExplorer-backend' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

logger.debug({ level: loggingConfig.level }, 'Logger initialized');

module.exports = logger;

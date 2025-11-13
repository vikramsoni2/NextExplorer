const { directories } = require('../config/index');
const { ensureDir } = require('./fsUtils');
const logger = require('./logger');

/**
 * Bootstrap application by ensuring required directories exist
 */
const bootstrap = async () => {
  logger.debug('Bootstrap start');

  // Ensure cache directory exists
  try {
    await ensureDir(directories.cache);
    logger.debug({ dir: directories.cache }, 'Cache directory ensured');
  } catch (error) {
    logger.warn(
      { directory: directories.cache, err: error },
      'Unable to prepare cache directory'
    );
  }

  // Ensure thumbnails directory exists
  try {
    await ensureDir(directories.thumbnails);
    logger.debug({ dir: directories.thumbnails }, 'Thumbnails directory ensured');
  } catch (error) {
    logger.warn(
      { directory: directories.thumbnails, err: error },
      'Unable to prepare thumbnail directory'
    );
  }

  logger.debug('Bootstrap complete');
};

module.exports = { bootstrap };
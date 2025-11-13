const { directories } = require('../config/index');
const { ensureDir } = require('./fsUtils');
const logger = require('./logger');

const bootstrap = async () => {
  logger.debug('Bootstrap start');

  const dirEntries = [
    ['config', directories.config],
    ['cache', directories.cache],
    ['thumbnails', directories.thumbnails],
  ];

  await Promise.all(dirEntries.map(async ([name, dir]) => {
    try {
      await ensureDir(dir);
      logger.debug({ dir }, `${name} directory ensured`);
    } catch (error) {
      logger.warn({ directory: dir, err: error }, `Unable to prepare ${name} directory`);
    }
  }));

  logger.debug('Bootstrap complete');
};

module.exports = { bootstrap };


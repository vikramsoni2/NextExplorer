const logger = require('../utils/logger');

const configureTrustProxy = (app) => {
  try {
    const { getTrustProxySetting } = require('../config/trustProxy');
    const tp = getTrustProxySetting();

    if (tp.set) {
      app.set('trust proxy', tp.value);
    }

    if (tp.message) {
      logger.info({ message: tp.message }, 'Trust proxy configured');
    } else {
      logger.debug('Trust proxy not explicitly configured');
    }
  } catch (e) {
    logger.warn({ err: e }, 'Failed to configure trust proxy');
  }
};

module.exports = { configureTrustProxy };

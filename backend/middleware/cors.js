const cors = require('cors');
const { corsOptions } = require('../config/index');
const logger = require('../utils/logger');

const configureCors = (app) => {
  app.use(cors(corsOptions));
  logger.debug('CORS middleware configured');
};

module.exports = { configureCors };
const crypto = require('crypto');
const session = require('express-session');
const { auth: envAuthConfig, public: publicConfig } = require('../config/index');
const logger = require('../utils/logger');

const configureSession = (app) => {
  const sessionSecret = (envAuthConfig && envAuthConfig.sessionSecret)
    || process.env.SESSION_SECRET
    || crypto.randomBytes(32).toString('hex');

  logger.debug({ hasSessionSecret: Boolean(sessionSecret) }, 'Session secret resolved');

  // Always enable Express session for local auth if a secret is provided
  // Use "auto" so cookies are Secure only when connection is HTTPS.
  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: 'auto',
    },
  }));
  
  logger.debug('Express session middleware configured');
};

module.exports = { configureSession };
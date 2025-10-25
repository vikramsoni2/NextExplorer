const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const session = require('express-session');

const { port, directories, corsOptions } = require('./config/index');
const { ensureDir } = require('./utils/fsUtils');
const registerRoutes = require('./routes');
const authRoutes = require('./routes/auth');
const authMiddleware = require('./middleware/authMiddleware');
const { initializeAuth } = require('./services/authService');
const {
  passport: passportInstance,
  initializePassport,
  resolveSecurityConfig,
} = require('./services/passport');

const app = express();
let server = null;

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

const bootstrap = async () => {
  try {
    await ensureDir(directories.cache);
  } catch (error) {
    console.warn(`Unable to prepare cache directory at ${directories.cache}:`, error.message);
  }

  try {
    await ensureDir(directories.thumbnails);
  } catch (error) {
    console.warn(`Unable to prepare thumbnail directory at ${directories.thumbnails}:`, error.message);
  }

  try {
    await initializeAuth();
  } catch (error) {
    console.error('Failed to initialize authentication services:', error);
  }

  try {
    await initializePassport();
  } catch (error) {
    console.error('Failed to configure Passport strategies:', error);
  }

  let securityConfig = null;
  try {
    securityConfig = await resolveSecurityConfig();
  } catch (error) {
    console.warn('Unable to resolve security configuration from settings:', error.message);
  }

  const sessionSecret = (securityConfig && securityConfig.sessionSecret)
    || process.env.SESSION_SECRET
    || crypto.randomBytes(32).toString('hex');

  if (!sessionSecret) {
    console.warn('SESSION_SECRET could not be determined; falling back to an ephemeral secret. Sessions will reset on restart.');
  } else if (!process.env.SESSION_SECRET && !(securityConfig && securityConfig.sessionSecret)) {
    console.warn('SESSION_SECRET is not configured; using an ephemeral secret. Sessions will reset on restart.');
  }

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };

  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: cookieOptions,
  }));

  app.use(passportInstance.initialize());
  app.use(passportInstance.session());

  app.use('/api/auth', authRoutes);
  app.use(authMiddleware);

  app.use('/static/thumbnails', express.static(directories.thumbnails));
  registerRoutes(app);

  const frontendDir = path.resolve(__dirname, 'public');
  const indexFile = path.join(frontendDir, 'index.html');

  if (fs.existsSync(frontendDir) && fs.existsSync(indexFile)) {
    app.use(express.static(frontendDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/static/thumbnails')) {
        return next();
      }

      if (!['GET', 'HEAD'].includes(req.method)) {
        return next();
      }

      res.sendFile(indexFile);
    });
  }

  server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
  });
};

bootstrap().catch((error) => {
  console.error('Failed to bootstrap application:', error);
});

module.exports = {
  app,
  get server() {
    return server;
  },
};

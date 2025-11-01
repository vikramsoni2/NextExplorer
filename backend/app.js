const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const session = require('express-session');

const { port, directories, corsOptions, public: publicConfig } = require('./config/index');
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

// Trust reverse proxy when a PUBLIC_URL is provided or TRUST_PROXY is explicitly set
function normalizeEnvVar(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

try {
  const trustProxyEnv = normalizeEnvVar(process.env.TRUST_PROXY);
  if (trustProxyEnv) {
    // Map common values to proper trust proxy settings
    const normalized = trustProxyEnv.toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      app.set('trust proxy', true);
    } else if (['0', 'false', 'no', 'off'].includes(normalized)) {
      app.set('trust proxy', false);
    } else if (!Number.isNaN(Number(trustProxyEnv))) {
      app.set('trust proxy', Number(trustProxyEnv));
    } else {
      // Accept Express trust proxy presets or CIDR/source strings
      app.set('trust proxy', trustProxyEnv);
    }
  } else if (publicConfig && publicConfig.url) {
    // If PUBLIC_URL is set, assume we are behind a proxy
    app.set('trust proxy', true);
  }
} catch (e) {
  console.warn('Failed to configure trust proxy:', e?.message || e);
}

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

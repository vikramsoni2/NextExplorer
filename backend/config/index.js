const path = require('path');
const logger = require('../utils/logger');
const { normalizeBoolean } = require('../utils/env');
const loggingConfig = require('./logging');
const crypto = require('crypto');


const parseScopes = (raw) => {
  if (typeof raw !== 'string') return null;

  const source = raw.trim();
  const parts = source.includes(',')
    ? source.split(',')
    : source.split(/\s+/);

  return parts.map(s => s.trim()).filter(Boolean);
};


const port = Number(process.env.PORT) || 3000;
const volumeDir = path.resolve(process.env.VOLUME_ROOT || '/mnt');
const volumeWithSep = volumeDir.endsWith(path.sep) ? volumeDir : `${volumeDir}${path.sep}`;
const cacheDir = path.resolve(process.env.CACHE_DIR || '/cache');
const thumbnailDir = path.join(cacheDir, 'thumbnails');
const passwordConfigFile = path.join(cacheDir, 'app-config.json');

const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tif', 'tiff', 'avif', 'heic'];
const videoExtensions = ['mp4', 'mov', 'mkv', 'webm', 'm4v', 'avi', 'wmv', 'flv', 'mpg', 'mpeg'];
const documentExtensions = ['pdf'];
const excludedFiles = ['thumbs.db', '.DS_Store'];

const mimeTypes = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  avif: 'image/avif',
  heic: 'image/heic',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  m4v: 'video/x-m4v',
  avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
  pdf: 'application/pdf',
};

const previewableExtensions = new Set([...imageExtensions, ...videoExtensions, ...documentExtensions]);

// Centralized public URL (for reverse proxy setups / custom domains)
// Example: PUBLIC_URL=https://files.example.com
const rawPublicUrl = typeof process.env.PUBLIC_URL === 'string' ? process.env.PUBLIC_URL.trim() : '';
let publicUrl = null;
let publicOrigin = null;
try {
  if (rawPublicUrl) {
    const { href, origin } = new URL(rawPublicUrl);
    publicUrl = href.replace(/\/$/, '');
    publicOrigin = origin;
  }
} catch (err) {
  logger.warn(
    { publicUrl: rawPublicUrl, error: err.message },
    'Invalid PUBLIC_URL provided'
  );
}

const rawAllowedOrigins = process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS || '';
const hasExplicitCors = rawAllowedOrigins.trim() !== '';

let allowAllOrigins = false;
let allowedOriginList = [];

if (hasExplicitCors) {
  if (rawAllowedOrigins.trim() === '*') {
    allowAllOrigins = true;
    allowedOriginList = [];
  } else {
    allowAllOrigins = false;
    allowedOriginList = rawAllowedOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
} else if (publicOrigin) {
  // Default to the PUBLIC_URL origin when CORS origins are not explicitly set
  allowAllOrigins = false;
  allowedOriginList = [publicOrigin];
} else {
  // Backwards-compatibility: if nothing configured at all, allow all
  allowAllOrigins = true;
  allowedOriginList = [];
}

const corsOptions = {
  origin: (origin, callback) => {
    if (allowAllOrigins) {
      callback(null, true);
      return;
    }
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOriginList.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

// Legacy support retained; minimal OIDC integration defaults to 'oidc'
const supportedAuthModes = new Set(['local', 'oidc', 'both']);
const normalizedAuthMode = 'oidc';


const rawEnvScopes = process.env.OIDC_SCOPES || process.env.OIDC_SCOPE || null;
const rawAdminGroups = process.env.OIDC_ADMIN_GROUPS || process.env.OIDC_ADMIN_GROUP || null;

const envOidcConfig = {
  enabled: normalizeBoolean(process.env.OIDC_ENABLED) ?? null,
  issuer: process.env.OIDC_ISSUER || process.env.OIDC_ISSUER_URL || null,
  authorizationURL: process.env.OIDC_AUTHORIZATION_URL || null,
  tokenURL: process.env.OIDC_TOKEN_URL || null,
  userInfoURL: process.env.OIDC_USERINFO_URL || null,
  clientId: process.env.OIDC_CLIENT_ID || null,
  clientSecret: process.env.OIDC_CLIENT_SECRET || null,
  // If not explicitly set, derive callback from PUBLIC_URL
  callbackUrl: process.env.OIDC_CALLBACK_URL
    || process.env.OIDC_REDIRECT_URI
    || (publicUrl ? `${publicUrl}/callback` : null),
  scopes: parseScopes(rawEnvScopes) || null,
  // Admin groups used to elevate user to app 'admin' role
  adminGroups: parseScopes(rawAdminGroups) || null,
};

const envAuthConfig = {
  sessionSecret: process.env.SESSION_SECRET || process.env.AUTH_SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  authMode: normalizedAuthMode,
  oidc: envOidcConfig,
};

module.exports = {
  port,
  directories: {
    volume: volumeDir,
    volumeWithSep,
    cache: cacheDir,
    thumbnails: thumbnailDir,
  },
  files: {
    passwordConfig: passwordConfigFile,
  },
  extensions: {
    images: imageExtensions,
    videos: videoExtensions,
    documents: documentExtensions,
    previewable: previewableExtensions,
  },
  excludedFiles,
  mimeTypes,
  corsOptions,
  public: {
    url: publicUrl,
    origin: publicOrigin,
  },
  thumbnails: {
    size: 200,
    quality: 70
  },
  auth: envAuthConfig,
  logging: {
    level: loggingConfig.level,
    isDebug: loggingConfig.isDebug,
    enableHttpLogging: loggingConfig.enableHttpLogging,
  },
};

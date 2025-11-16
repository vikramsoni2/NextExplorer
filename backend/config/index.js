const path = require('path');
const crypto = require('crypto');
const env = require('./env');
const constants = require('./constants');
const loggingConfig = require('./logging');
const { parseByteSize } = require('../utils/env');

// Helper: Parse comma/space-separated scopes
const parseScopes = (raw) => {
  if (!raw) return null;
  const parts = raw.includes(',') ? raw.split(',') : raw.split(/\s+/);
  return parts.map(s => s.trim()).filter(Boolean);
};

// --- Paths ---
const volumeDir = path.resolve(env.VOLUME_ROOT);
const configDir = path.resolve(env.CONFIG_DIR);
const cacheDir = path.resolve(env.CACHE_DIR);

const directories = {
  volume: volumeDir,
  volumeWithSep: volumeDir.endsWith(path.sep) ? volumeDir : `${volumeDir}${path.sep}`,
  config: configDir,
  cache: cacheDir,
  thumbnails: path.join(cacheDir, 'thumbnails'),
  extensions: path.join(configDir, 'extensions'),
};

// --- Public URL ---
let publicUrl = null;
let publicOrigin = null;
if (env.PUBLIC_URL) {
  try {
    const url = new URL(env.PUBLIC_URL);
    publicUrl = url.href.replace(/\/$/, '');
    publicOrigin = url.origin;
  } catch (err) {
    console.warn(`[Config] Invalid PUBLIC_URL: ${env.PUBLIC_URL}`);
  }
}

// --- CORS ---
const buildCorsConfig = () => {
  if (env.CORS_ORIGINS) {
    if (env.CORS_ORIGINS === '*') return { allowAll: true, origins: [] };
    return { allowAll: false, origins: env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean) };
  }
  if (publicOrigin) return { allowAll: false, origins: [publicOrigin] };
  return { allowAll: true, origins: [] }; // Backwards compatibility
};

const corsConfig = buildCorsConfig();
const corsOptions = {
  origin: (origin, callback) => {
    if (corsConfig.allowAll || !origin || corsConfig.origins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

// --- Auth ---
// Determine auth mode: 'local', 'oidc', 'both', or 'disabled'
// If AUTH_MODE is not set, fall back to legacy behavior based on OIDC_ENABLED
const determineAuthMode = () => {
  if (env.AUTH_MODE) {
    const validModes = ['local', 'oidc', 'both', 'disabled'];
    if (!validModes.includes(env.AUTH_MODE)) {
      console.warn(`[Config] Invalid AUTH_MODE="${env.AUTH_MODE}". Using "both" as default.`);
      return 'both';
    }
    return env.AUTH_MODE;
  }
  return 'both';
};

const authMode = determineAuthMode();

const auth = {
  enabled: authMode === 'disabled' ? false : (env.AUTH_ENABLED !== false),
  sessionSecret: env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  mode: authMode,
  oidc: {
    enabled: env.OIDC_ENABLED ?? null,
    issuer: env.OIDC_ISSUER,
    authorizationURL: env.OIDC_AUTHORIZATION_URL,
    tokenURL: env.OIDC_TOKEN_URL,
    userInfoURL: env.OIDC_USERINFO_URL,
    clientId: env.OIDC_CLIENT_ID,
    clientSecret: env.OIDC_CLIENT_SECRET,
    callbackUrl: env.OIDC_CALLBACK_URL || (publicUrl ? `${publicUrl}/callback` : null),
    scopes: parseScopes(env.OIDC_SCOPES) || null,
    adminGroups: parseScopes(env.OIDC_ADMIN_GROUPS) || null,
    requireEmailVerified: env.OIDC_REQUIRE_EMAIL_VERIFIED,
  },
};

// --- Search ---
const searchMaxFileSizeBytes = (() => {
  const parsed = parseByteSize(env.SEARCH_MAX_FILESIZE);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5 * 1024 * 1024;
})();

// --- OnlyOffice ---
const onlyoffice = {
  serverUrl: env.ONLYOFFICE_URL?.replace(/\/$/, '') || null,
  secret: env.ONLYOFFICE_SECRET || env.SESSION_SECRET || auth.sessionSecret,
  lang: env.ONLYOFFICE_LANG,
  forceSave: env.ONLYOFFICE_FORCE_SAVE,
  extensions: env.ONLYOFFICE_FILE_EXTENSIONS.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
};

// --- Editor ---
const editor = {
  extensions: env.EDITOR_EXTENSIONS.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
};

// --- Favorites ---
const favorites = {
  defaultIcon: env.FAVORITES_DEFAULT_ICON,
};

// --- Main Export ---
module.exports = {
  port: env.PORT,
  directories,
  
  files: {
    passwordConfig: path.join(configDir, 'app-config.json'),
  },
  
  public: { url: publicUrl, origin: publicOrigin },
  
  extensions: {
    images: constants.IMAGE_EXTENSIONS,
    videos: constants.VIDEO_EXTENSIONS,
    documents: constants.DOCUMENT_EXTENSIONS,
    previewable: constants.PREVIEWABLE_EXTENSIONS,
  },
  
  excludedFiles: constants.EXCLUDED_FILES,
  mimeTypes: constants.MIME_TYPES,
  corsOptions,
  
  auth,
  
  search: {
    deep: env.SEARCH_DEEP ?? true,
    ripgrep: env.SEARCH_RIPGREP ?? true,
    maxFileSize: env.SEARCH_MAX_FILESIZE,
    maxFileSizeBytes: searchMaxFileSizeBytes,
  },
  
  thumbnails: { size: 200, quality: 70 },
  onlyoffice,
  editor,
  favorites,

  features: {
    volumeUsage: env.SHOW_VOLUME_USAGE,
  },
  
  logging: {
    level: loggingConfig.level,
    isDebug: loggingConfig.isDebug,
    enableHttpLogging: loggingConfig.enableHttpLogging,
  },
};

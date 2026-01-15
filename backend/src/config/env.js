const { normalizeBoolean, parseByteSize } = require('../utils/env');

/**
 * Single source of truth for ALL environment variables.
 * Easy to see what env vars the app uses and their defaults.
 */
module.exports = {
  // Server
  PORT: Number(process.env.PORT) || 3000,
  // Node.js HTTP server request timeout (ms). Set to 0 to disable.
  // Node defaults to 300000ms (5 minutes) on modern versions, which can abort large uploads.
  HTTP_TIMEOUT: process.env.HTTP_TIMEOUT != null ? Number(process.env.HTTP_TIMEOUT) : 0,

  // Paths
  VOLUME_ROOT: process.env.VOLUME_ROOT || '/mnt',
  CONFIG_DIR: process.env.CONFIG_DIR || '/config',
  CACHE_DIR: process.env.CACHE_DIR || '/cache',
  USER_ROOT: process.env.USER_ROOT || '',
  USER_FOLDER_NAME_ORDER: process.env.USER_FOLDER_NAME_ORDER?.trim() || null,

  // Public URL & Network
  PUBLIC_URL: process.env.PUBLIC_URL?.trim() || null,
  TRUST_PROXY: process.env.TRUST_PROXY?.trim().toLowerCase(),

  // CORS
  CORS_ORIGINS:
    process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS || '',

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL?.trim().toLowerCase() || null,
  DEBUG: normalizeBoolean(process.env.DEBUG),
  ENABLE_HTTP_LOGGING: normalizeBoolean(process.env.ENABLE_HTTP_LOGGING) || false,

  // Auth
  AUTH_ENABLED: normalizeBoolean(process.env.AUTH_ENABLED),
  AUTH_MODE: process.env.AUTH_MODE?.trim().toLowerCase() || null,
  SESSION_SECRET: process.env.SESSION_SECRET || process.env.AUTH_SESSION_SECRET || null,
  AUTH_MAX_FAILED: Number(process.env.AUTH_MAX_FAILED) || 5,
  AUTH_LOCK_MINUTES: Number(process.env.AUTH_LOCK_MINUTES) || 15,
  AUTH_ADMIN_EMAIL: process.env.AUTH_ADMIN_EMAIL?.trim() || process.env.ADMIN_EMAIL?.trim() || null,
  AUTH_ADMIN_PASSWORD: process.env.AUTH_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || null,

  // OIDC
  OIDC_ENABLED: normalizeBoolean(process.env.OIDC_ENABLED),
  OIDC_ISSUER: process.env.OIDC_ISSUER || process.env.OIDC_ISSUER_URL || null,
  OIDC_AUTHORIZATION_URL: process.env.OIDC_AUTHORIZATION_URL || null,
  OIDC_TOKEN_URL: process.env.OIDC_TOKEN_URL || null,
  OIDC_USERINFO_URL: process.env.OIDC_USERINFO_URL || null,
  OIDC_CLIENT_ID: process.env.OIDC_CLIENT_ID || null,
  OIDC_CLIENT_SECRET: process.env.OIDC_CLIENT_SECRET || null,
  OIDC_CALLBACK_URL: process.env.OIDC_CALLBACK_URL || process.env.OIDC_REDIRECT_URI || null,
  OIDC_SCOPES: process.env.OIDC_SCOPES || process.env.OIDC_SCOPE || null,
  OIDC_ADMIN_GROUPS: process.env.OIDC_ADMIN_GROUPS || process.env.OIDC_ADMIN_GROUP || null,
  OIDC_REQUIRE_EMAIL_VERIFIED: normalizeBoolean(process.env.OIDC_REQUIRE_EMAIL_VERIFIED) || false,
  // When false, OIDC login is only allowed for users that already exist in the DB (local or OIDC-linked).
  OIDC_AUTO_CREATE_USERS: normalizeBoolean(process.env.OIDC_AUTO_CREATE_USERS) ?? true,

  // Search
  SEARCH_DEEP: normalizeBoolean(process.env.SEARCH_DEEP),
  SEARCH_RIPGREP: normalizeBoolean(process.env.SEARCH_RIPGREP),
  SEARCH_MAX_FILESIZE: process.env.SEARCH_MAX_FILESIZE?.trim() || null,

  // OnlyOffice
  ONLYOFFICE_URL: process.env.ONLYOFFICE_URL?.trim() || null,
  ONLYOFFICE_SECRET: process.env.ONLYOFFICE_SECRET || null,
  ONLYOFFICE_LANG: process.env.ONLYOFFICE_LANG?.trim() || 'en',
  ONLYOFFICE_FORCE_SAVE: normalizeBoolean(process.env.ONLYOFFICE_FORCE_SAVE) || false,
  ONLYOFFICE_FILE_EXTENSIONS: process.env.ONLYOFFICE_FILE_EXTENSIONS || '',

  // Collabora (WOPI)
  COLLABORA_URL: process.env.COLLABORA_URL?.trim() || null,
  COLLABORA_DISCOVERY_URL: process.env.COLLABORA_DISCOVERY_URL?.trim() || null,
  COLLABORA_SECRET: process.env.COLLABORA_SECRET || null,
  COLLABORA_LANG: process.env.COLLABORA_LANG?.trim() || 'en',
  COLLABORA_FILE_EXTENSIONS: process.env.COLLABORA_FILE_EXTENSIONS || '',

  // Features
  SHOW_VOLUME_USAGE: normalizeBoolean(process.env.SHOW_VOLUME_USAGE) || false,
  USER_DIR_ENABLED: normalizeBoolean(process.env.USER_DIR_ENABLED) || false,
  USER_VOLUMES: normalizeBoolean(process.env.USER_VOLUMES) || false,
  SKIP_HOME: normalizeBoolean(process.env.SKIP_HOME) || false,

  // Editor
  EDITOR_EXTENSIONS: process.env.EDITOR_EXTENSIONS || '',

  // FFmpeg
  FFMPEG_PATH: process.env.FFMPEG_PATH || null,
  FFPROBE_PATH: process.env.FFPROBE_PATH || null,

  // Favorites
  FAVORITES_DEFAULT_ICON: process.env.FAVORITES_DEFAULT_ICON || 'outline:StarIcon',

  // Shares
  SHARES_ENABLED: normalizeBoolean(process.env.SHARES_ENABLED) ?? true,
  SHARES_TOKEN_LENGTH: Number(process.env.SHARES_TOKEN_LENGTH) || 10,
  SHARES_MAX_PER_USER: Number(process.env.SHARES_MAX_PER_USER) || 100,
  SHARES_DEFAULT_EXPIRY_DAYS: Number(process.env.SHARES_DEFAULT_EXPIRY_DAYS) || 30,
  SHARES_GUEST_SESSION_HOURS: Number(process.env.SHARES_GUEST_SESSION_HOURS) || 24,
  SHARES_ALLOW_PASSWORD: normalizeBoolean(process.env.SHARES_ALLOW_PASSWORD) ?? true,
  SHARES_ALLOW_ANONYMOUS: normalizeBoolean(process.env.SHARES_ALLOW_ANONYMOUS) ?? true,
};

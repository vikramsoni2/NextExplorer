const fs = require('fs/promises');
const crypto = require('crypto');

const { directories, files } = require('../config/index');
const { ensureDir } = require('../utils/fsUtils');
const { normalizeRelativePath, resolveVolumePath } = require('../utils/pathUtils');

const CONFIG_ENCODING = 'utf8';
const DEFAULT_ITERATIONS = 210000;
const CONFIG_FILE_PATH = files.passwordConfig;
const SUPPORTED_AUTH_MODES = ['local', 'oidc', 'both'];
const DEFAULT_AUTH_MODE = 'local';

const DEFAULT_CONFIG = {
  version: 4,
  auth: {
    passwordHash: null,
    salt: null,
    iterations: DEFAULT_ITERATIONS,
    createdAt: null,
  },
  users: [],
  // App-level settings (extendable)
  settings: {
    thumbnails: {
      enabled: true,
      size: 200,
      quality: 70,
    },
    security: {
      authEnabled: true,
      authMode: DEFAULT_AUTH_MODE,
      sessionSecret: null,
      oidc: {
        enabled: false,
        issuer: null,
        authorizationURL: null,
        tokenURL: null,
        userInfoURL: null,
        clientId: null,
        clientSecret: null,
        callbackUrl: null,
        scopes: ['openid', 'profile', 'email'],
      },
    },
    access: {
      // Array of rules { id, path, recursive, permissions: 'rw'|'ro'|'hidden' }
      rules: [],
    },
  },
  favorites: [],
};

let configCache = null;
let initialized = false;

const randomId = () => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}`;
};

const sanitizeAuth = (candidate = {}) => ({
  passwordHash: typeof candidate.passwordHash === 'string' ? candidate.passwordHash : null,
  salt: typeof candidate.salt === 'string' ? candidate.salt : null,
  iterations: Number.isFinite(candidate.iterations) ? candidate.iterations : DEFAULT_ITERATIONS,
  createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : null,
});

const sanitizeUser = (candidate) => {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const username = typeof candidate.username === 'string' ? candidate.username.trim() : '';
  if (!username) {
    return null;
  }

  const id = typeof candidate.id === 'string' && candidate.id.trim()
    ? candidate.id.trim()
    : randomId();

  const provider = typeof candidate.provider === 'string' && ['local', 'oidc'].includes(candidate.provider)
    ? candidate.provider
    : 'local';

  const iterations = Number.isFinite(candidate.iterations) ? candidate.iterations : DEFAULT_ITERATIONS;
  const roles = Array.isArray(candidate.roles)
    ? Array.from(new Set(candidate.roles.map((role) => (typeof role === 'string' ? role.trim() : '')).filter(Boolean)))
    : [];

  const sanitized = {
    id,
    username,
    provider,
    roles,
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString(),
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
  };

  if (provider === 'local') {
    sanitized.passwordHash = typeof candidate.passwordHash === 'string' ? candidate.passwordHash : null;
    sanitized.salt = typeof candidate.salt === 'string' ? candidate.salt : null;
    sanitized.iterations = iterations;
  } else {
    sanitized.passwordHash = null;
    sanitized.salt = null;
    sanitized.iterations = DEFAULT_ITERATIONS;
  }

  if (provider === 'oidc') {
    sanitized.oidcSub = typeof candidate.oidcSub === 'string' ? candidate.oidcSub : null;
    sanitized.oidcIssuer = typeof candidate.oidcIssuer === 'string' ? candidate.oidcIssuer : null;
    sanitized.displayName = typeof candidate.displayName === 'string' ? candidate.displayName : null;
    sanitized.email = typeof candidate.email === 'string' ? candidate.email : null;
  } else {
    sanitized.oidcSub = null;
    sanitized.oidcIssuer = null;
    sanitized.displayName = typeof candidate.displayName === 'string' ? candidate.displayName : null;
    sanitized.email = typeof candidate.email === 'string' ? candidate.email : null;
  }

  return sanitized;
};

const sanitizeUsers = (users = []) => {
  if (!Array.isArray(users)) {
    return [];
  }

  const seenUsernames = new Set();
  const seenIds = new Set();

  return users.map((candidate) => sanitizeUser(candidate))
    .filter((user) => {
      if (!user) {
        return false;
      }
      if (seenIds.has(user.id) || seenUsernames.has(user.username)) {
        return false;
      }
      if (user.provider === 'local' && (!user.passwordHash || !user.salt)) {
        return false;
      }
      if (user.provider === 'oidc' && (!user.oidcSub || !user.oidcIssuer)) {
        return false;
      }
      seenIds.add(user.id);
      seenUsernames.add(user.username);
      return true;
    });
};

const sanitizeFavorite = (candidate) => {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const rawPath = typeof candidate.path === 'string' ? candidate.path.trim() : '';
  if (!rawPath) {
    return null;
  }

  let normalizedPath;
  try {
    normalizedPath = normalizeRelativePath(rawPath);
  } catch (error) {
    return null;
  }

  if (!normalizedPath) {
    return null;
  }

  const icon = typeof candidate.icon === 'string' && candidate.icon.trim()
    ? candidate.icon.trim()
    : 'solid:StarIcon';

  return {
    path: normalizedPath,
    icon,
  };
};

const sanitizeFavorites = (favorites) => {
  if (!Array.isArray(favorites)) {
    return [];
  }

  const seen = new Set();
  const result = [];

  favorites.forEach((entry) => {
    const favorite = sanitizeFavorite(entry);
    if (!favorite) return;
    if (seen.has(favorite.path)) return;
    seen.add(favorite.path);
    result.push(favorite);
  });

  return result;
};

const sanitizeConfig = (candidate = {}) => {
  const sanitizedAuth = candidate && typeof candidate === 'object'
    ? (candidate.auth && typeof candidate.auth === 'object'
      ? sanitizeAuth(candidate.auth)
      : sanitizeAuth({
        passwordHash: candidate.passwordHash,
        salt: candidate.salt,
        iterations: candidate.iterations,
        createdAt: candidate.createdAt,
      }))
    : sanitizeAuth();

  const favorites = sanitizeFavorites(candidate?.favorites);

  const sanitizeSettings = (settings) => {
    const t = settings?.thumbnails || {};
    const s = settings?.security || {};
    const a = settings?.access || {};
    const rules = Array.isArray(a.rules) ? a.rules : [];

    const sanitizedRules = rules
      .map((r) => {
        if (!r || typeof r !== 'object') return null;
        const path = typeof r.path === 'string' ? r.path.trim() : '';
        if (!path) return null;
        const recursive = Boolean(r.recursive);
        const permissions = ['rw', 'ro', 'hidden'].includes(r.permissions) ? r.permissions : 'rw';
        const id = typeof r.id === 'string' && r.id ? r.id : String(Date.now()) + Math.random().toString(36).slice(2);
        return { id, path, recursive, permissions };
      })
      .filter(Boolean);

    return {
      thumbnails: {
        enabled: typeof t.enabled === 'boolean' ? t.enabled : true,
        size: Number.isFinite(t.size) ? Math.max(64, Math.min(1024, Math.floor(t.size))) : 200,
        quality: Number.isFinite(t.quality) ? Math.max(1, Math.min(100, Math.floor(t.quality))) : 70,
      },
      security: {
        authEnabled: typeof s.authEnabled === 'boolean' ? s.authEnabled : true,
        authMode: SUPPORTED_AUTH_MODES.includes(s.authMode) ? s.authMode : DEFAULT_AUTH_MODE,
        sessionSecret: typeof s.sessionSecret === 'string' ? s.sessionSecret : null,
        oidc: {
          enabled: typeof s?.oidc?.enabled === 'boolean' ? s.oidc.enabled : false,
          issuer: typeof s?.oidc?.issuer === 'string' ? s.oidc.issuer : null,
          authorizationURL: typeof s?.oidc?.authorizationURL === 'string' ? s.oidc.authorizationURL : null,
          tokenURL: typeof s?.oidc?.tokenURL === 'string' ? s.oidc.tokenURL : null,
          userInfoURL: typeof s?.oidc?.userInfoURL === 'string' ? s.oidc.userInfoURL : null,
          clientId: typeof s?.oidc?.clientId === 'string' ? s.oidc.clientId : null,
          clientSecret: typeof s?.oidc?.clientSecret === 'string' ? s.oidc.clientSecret : null,
          callbackUrl: typeof s?.oidc?.callbackUrl === 'string' ? s.oidc.callbackUrl : null,
          scopes: Array.isArray(s?.oidc?.scopes) && s.oidc.scopes.length
            ? Array.from(new Set(s.oidc.scopes.filter((scope) => typeof scope === 'string' && scope.trim()).map((scope) => scope.trim())))
            : ['openid', 'profile', 'email'],
          adminGroups: Array.isArray(s?.oidc?.adminGroups) && s.oidc.adminGroups.length
            ? Array.from(new Set(s.oidc.adminGroups
                .map((g) => (typeof g === 'string' ? g.trim() : ''))
                .filter(Boolean)))
            : [],
        },
      },
      access: {
        rules: sanitizedRules,
      },
    };
  };

  const candidateVersion = Number.isFinite(candidate?.version) ? candidate.version : 4;
  const version = candidateVersion >= 4 ? candidateVersion : 4;

  const settings = sanitizeSettings(candidate?.settings || {});

  return {
    version,
    auth: sanitizedAuth,
    users: sanitizeUsers(candidate?.users),
    settings,
    favorites,
  };
};

const cloneConfig = (config) => ({
  version: config.version,
  auth: { ...config.auth },
  users: config.users.map((user) => ({ ...user })),
  settings: JSON.parse(JSON.stringify(config.settings || {})),
  favorites: config.favorites.map((favorite) => ({ ...favorite })),
});

const writeConfig = async (nextConfig) => {
  const payload = sanitizeConfig(nextConfig);
  await fs.writeFile(CONFIG_FILE_PATH, `${JSON.stringify(payload, null, 2)}\n`, CONFIG_ENCODING);
  configCache = payload;
  return payload;
};

const readConfig = async () => {
  try {
    const raw = await fs.readFile(CONFIG_FILE_PATH, CONFIG_ENCODING);
    if (!raw) {
      return sanitizeConfig();
    }
    const parsed = JSON.parse(raw);
    return sanitizeConfig(parsed);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return sanitizeConfig();
    }
    console.warn('Failed to read app config; defaulting to empty config.', error);
    return sanitizeConfig();
  }
};

const ensureInitialized = async () => {
  if (initialized) {
    return;
  }

  await ensureDir(directories.cache);

  try {
    await fs.access(CONFIG_FILE_PATH);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      await writeConfig(DEFAULT_CONFIG);
    } else {
      throw error;
    }
  }

  configCache = await readConfig();
  initialized = true;
};

const getConfig = async () => {
  await ensureInitialized();
  return configCache;
};

const updateConfig = async (updater) => {
  await ensureInitialized();
  const current = cloneConfig(configCache);
  const next = typeof updater === 'function'
    ? updater(current)
    : { ...current, ...updater };
  return writeConfig(next);
};

const getAuthConfig = async () => {
  const config = await getConfig();
  return { ...config.auth };
};

const setAuthConfig = async (authConfig) => {
  const nextAuth = sanitizeAuth(authConfig);
  const updated = await updateConfig((config) => ({
    ...config,
    auth: nextAuth,
  }));
  return { ...updated.auth };
};

const getUsers = async () => {
  const config = await getConfig();
  return config.users.map((user) => ({ ...user }));
};

const setUsers = async (users) => {
  const sanitizedUsers = sanitizeUsers(users);
  const updated = await updateConfig((config) => ({
    ...config,
    users: sanitizedUsers,
  }));
  return updated.users.map((user) => ({ ...user }));
};

const updateUsers = async (updater) => {
  await ensureInitialized();
  const currentUsers = configCache.users.map((user) => ({ ...user }));
  const nextUsers = typeof updater === 'function'
    ? updater(currentUsers)
    : (Array.isArray(updater) ? updater : []);
  return setUsers(nextUsers);
};

// SETTINGS helpers
const getSettings = async () => {
  const config = await getConfig();
  // return deep clone to avoid external mutation
  return JSON.parse(JSON.stringify(config.settings || DEFAULT_CONFIG.settings));
};

const setSettings = async (partial) => {
  const updated = await updateConfig((config) => ({
    ...config,
    settings: sanitizeConfig({ settings: { ...config.settings, ...(partial || {}) } }).settings,
  }));
  return JSON.parse(JSON.stringify(updated.settings));
};

const updateSettings = async (updater) => {
  const current = await getSettings();
  const next = typeof updater === 'function' ? updater(current) : { ...current, ...(updater || {}) };
  return setSettings(next);
};

const ensureDirectoryExists = async (relativePath) => {
  let absolutePath;
  try {
    absolutePath = resolveVolumePath(relativePath);
  } catch (error) {
    const invalid = new Error('Path is invalid.');
    invalid.status = 400;
    invalid.cause = error;
    throw invalid;
  }

  try {
    const stats = await fs.stat(absolutePath);
    if (!stats.isDirectory()) {
      const notDir = new Error('Path is not a directory.');
      notDir.status = 400;
      throw notDir;
    }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      const notFound = new Error('Path not found.');
      notFound.status = 404;
      throw notFound;
    }

    if (typeof error?.status === 'number') {
      throw error;
    }

    throw error;
  }
};

const getFavorites = async () => {
  const config = await getConfig();
  return config.favorites.map((favorite) => ({ ...favorite }));
};

const resolveFavoritePath = (rawPath) => {
  if (typeof rawPath !== 'string') {
    return null;
  }

  const trimmed = rawPath.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return normalizeRelativePath(trimmed);
  } catch (error) {
    const invalid = new Error('Path is invalid.');
    invalid.status = 400;
    invalid.cause = error;
    throw invalid;
  }
};

const addFavorite = async ({ path, icon }) => {
  const favorite = sanitizeFavorite({ path, icon });
  if (!favorite) {
    const error = new Error('A valid path is required.');
    error.status = 400;
    throw error;
  }

  await ensureDirectoryExists(favorite.path);

  const updated = await updateConfig((config) => {
    const existingIndex = config.favorites.findIndex((entry) => entry.path === favorite.path);
    const nextFavorites = [...config.favorites];
    if (existingIndex === -1) {
      nextFavorites.push(favorite);
    } else {
      nextFavorites.splice(existingIndex, 1, favorite);
    }
    return {
      ...config,
      favorites: nextFavorites,
    };
  });

  return updated.favorites.find((entry) => entry.path === favorite.path);
};

const removeFavorite = async (path) => {
  const normalizedPath = resolveFavoritePath(path);
  if (!normalizedPath) {
    const error = new Error('A valid path is required.');
    error.status = 400;
    throw error;
  }

  const updated = await updateConfig((config) => ({
    ...config,
    favorites: config.favorites.filter((entry) => entry.path !== normalizedPath),
  }));

  return updated.favorites.map((favorite) => ({ ...favorite }));
};

module.exports = {
  DEFAULT_ITERATIONS,
  DEFAULT_AUTH_MODE,
  SUPPORTED_AUTH_MODES,
  getConfig,
  updateConfig,
  getAuthConfig,
  setAuthConfig,
  getUsers,
  setUsers,
  updateUsers,
  getSettings,
  setSettings,
  updateSettings,
  getFavorites,
  addFavorite,
  removeFavorite,
};

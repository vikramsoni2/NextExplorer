const fs = require('fs/promises');

const { directories, files } = require('../config/index');
const { ensureDir } = require('../utils/fsUtils');
const { normalizeRelativePath, resolveVolumePath } = require('../utils/pathUtils');

const CONFIG_ENCODING = 'utf8';
const DEFAULT_ITERATIONS = 210000;
const CONFIG_FILE_PATH = files.passwordConfig;

const DEFAULT_CONFIG = {
  version: 2,
  auth: {
    passwordHash: null,
    salt: null,
    iterations: DEFAULT_ITERATIONS,
    createdAt: null,
  },
  favorites: [],
};

let configCache = null;
let initialized = false;

const sanitizeAuth = (candidate = {}) => ({
  passwordHash: typeof candidate.passwordHash === 'string' ? candidate.passwordHash : null,
  salt: typeof candidate.salt === 'string' ? candidate.salt : null,
  iterations: Number.isFinite(candidate.iterations) ? candidate.iterations : DEFAULT_ITERATIONS,
  createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : null,
});

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

  const candidateVersion = Number.isFinite(candidate?.version) ? candidate.version : 2;
  const version = candidateVersion >= 2 ? candidateVersion : 2;

  return {
    version,
    auth: sanitizedAuth,
    favorites,
  };
};

const cloneConfig = (config) => ({
  version: config.version,
  auth: { ...config.auth },
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
  getConfig,
  updateConfig,
  getAuthConfig,
  setAuthConfig,
  getFavorites,
  addFavorite,
  removeFavorite,
};

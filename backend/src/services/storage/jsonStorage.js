const fs = require('fs/promises');
const { directories, files } = require('../../config/index');
const { ensureDir } = require('../../utils/fsUtils');
const logger = require('../../utils/logger');

const CONFIG_FILE = files.passwordConfig;
const ENCODING = 'utf8';

let cache = null;
let initialized = false;

/**
 * Default structure for app-config.json
 */
const DEFAULT_DATA = {
  version: 4,
  settings: {
    thumbnails: { enabled: true, size: 200, quality: 70 },
    access: { rules: [] },
  },
  favorites: [],
};

/**
 * Ensure config directory and file exist
 */
const init = async () => {
  if (initialized) return;
  
  await ensureDir(directories.config);
  
  try {
    await fs.access(CONFIG_FILE);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      logger.info('Creating default config file');
      await fs.writeFile(CONFIG_FILE, JSON.stringify(DEFAULT_DATA, null, 2) + '\n', ENCODING);
    }
  }
  
  cache = await read();
  initialized = true;
};

/**
 * Read from disk
 */
const read = async () => {
  try {
    const raw = await fs.readFile(CONFIG_FILE, ENCODING);
    return JSON.parse(raw);
  } catch (error) {
    logger.warn({ err: error }, 'Failed to read config, using defaults');
    return { ...DEFAULT_DATA };
  }
};

/**
 * Write to disk and update cache
 */
const write = async (data) => {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(data, null, 2) + '\n', ENCODING);
  cache = data;
  return data;
};

/**
 * Get entire config
 */
const get = async () => {
  await init();
  return JSON.parse(JSON.stringify(cache)); // Deep clone
};

/**
 * Update config with an updater function
 */
const update = async (updater) => {
  await init();
  const current = await get();
  const next = updater(current);
  return write(next);
};

module.exports = { get, update };
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const DEFAULT_MODULES = ['src/config/env', 'src/config/index'];

const overrideEnv = (values) => {
  const previous = {};
  Object.entries(values).forEach(([key, value]) => {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });
  return () => {
    Object.entries(previous).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  };
};

const modulePath = (relative) => path.join(REPO_ROOT, relative);

const clearModuleCache = (moduleSource) => {
  try {
    const resolved = require.resolve(modulePath(moduleSource));
    delete require.cache[resolved];
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') {
      throw error;
    }
  }
};

const createTempDirs = async (tag = 'backend-tests-') => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), tag));
  const configDir = path.join(tmpRoot, 'config');
  const cacheDir = path.join(tmpRoot, 'cache');
  const volumeDir = path.join(tmpRoot, 'volume');
  await Promise.all([
    fs.mkdir(configDir, { recursive: true }),
    fs.mkdir(cacheDir, { recursive: true }),
    fs.mkdir(volumeDir, { recursive: true }),
  ]);
  return { tmpRoot, configDir, cacheDir, volumeDir };
};

const setupTestEnv = async ({ tag, modules = [], env = {} } = {}) => {
  const dirs = await createTempDirs(tag);
  const envOverrides = {
    CONFIG_DIR: dirs.configDir,
    CACHE_DIR: dirs.cacheDir,
    VOLUME_ROOT: dirs.volumeDir,
    SESSION_SECRET: 'test-secret',
    ...env,
  };
  const restoreEnv = overrideEnv(envOverrides);

  const modulesToClear = Array.from(new Set([...DEFAULT_MODULES, ...modules]));
  const clearAll = () => modulesToClear.forEach(clearModuleCache);
  clearAll();

  return {
    ...dirs,
    envOverrides,
    cleanup: async () => {
      restoreEnv();
      clearAll();
      await fs.rm(dirs.tmpRoot, { recursive: true, force: true });
    },
    requireFresh: (moduleSource) => {
      clearModuleCache(moduleSource);
      return require(modulePath(moduleSource));
    },
  };
};

module.exports = {
  overrideEnv,
  clearModuleCache,
  setupTestEnv,
};

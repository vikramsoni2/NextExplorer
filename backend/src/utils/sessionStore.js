const path = require('path');
const logger = require('../utils/logger');
const session = require('express-session');
const { directories } = require('../config/index');

const cacheDir = (directories && directories.cache) || '/cache';
const dbPath = path.join(cacheDir, 'sessions.db');

const SQLiteStore = require('connect-sqlite3')(session);

const baseStore = new SQLiteStore({
  db: path.basename(dbPath),
  dir: path.dirname(dbPath),
  createDirIfNotExists: true,
});

logger.debug({ dbPath }, 'Initialized shared SQLite session store');

const localStore = baseStore;

// OIDC sessions use a thin wrapper around the same store to ensure that
// express-openid-connect's safePromisify treats the methods as callback-based
// and never calls them without a callback argument.
const oidcStore = {
  get(sid, cb) {
    const callback = typeof cb === 'function' ? cb : () => {};
    return baseStore.get(sid, callback);
  },
  set(sid, sess, cb) {
    const callback = typeof cb === 'function' ? cb : () => {};
    return baseStore.set(sid, sess, callback);
  },
  destroy(sid, cb) {
    const callback = typeof cb === 'function' ? cb : () => {};
    return baseStore.destroy(sid, callback);
  },
};

module.exports = {
  localStore,
  oidcStore,
  dbPath,
};

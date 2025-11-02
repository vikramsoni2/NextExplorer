const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const { directories, files } = require('../config/index');
const { ensureDir } = require('../utils/fsUtils');

let dbInstance = null;

const getDbPath = () => {
  const cacheDir = directories.cache;
  // Generic app database for auth, shares, user settings, etc.
  return path.join(cacheDir, 'app.db');
};

const migrate = (db) => {
  // Simple schema versioning
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const getVersion = db.prepare('SELECT value FROM meta WHERE key = ?').pluck();
  let version = Number(getVersion.get('schema_version') || 0);

  db.transaction(() => {
    if (version < 1) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL CHECK(provider IN ('local','oidc')),
          username TEXT UNIQUE,
          password_hash TEXT,
          password_algo TEXT,
          oidc_issuer TEXT,
          oidc_sub TEXT,
          display_name TEXT,
          email TEXT,
          roles TEXT DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oidc ON users(oidc_issuer, oidc_sub);
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      `);
      db.prepare('INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)').run('schema_version', String(1));
      version = 1;
    }
    if (version < 2) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS auth_locks (
          key TEXT PRIMARY KEY, -- normalized username or subject key
          failed_count INTEGER NOT NULL DEFAULT 0,
          locked_until TEXT
        );
      `);
      db.prepare('INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)').run('schema_version', String(2));
      version = 2;
    }
  })();
};

const getDb = async () => {
  if (dbInstance) return dbInstance;

  const dbDir = directories.cache;
  await ensureDir(dbDir);
  const dbPath = getDbPath();

  // Ensure file exists for clarity (better-sqlite3 will create if needed)
  try {
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, '');
    }
  } catch (_) { /* ignore */ }

  const db = new Database(dbPath);
  migrate(db);
  dbInstance = db;
  return dbInstance;
};

module.exports = {
  getDb,
  getDbPath,
};

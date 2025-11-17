const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const { directories, files, favorites } = require('../config');
const { ensureDir } = require('../utils/fsUtils');

let dbInstance = null;

const getDbPath = () => {
  const configDir = directories.config;
  // Generic app database for auth, shares, and user settings.
  return path.join(configDir, 'app.db');
};

const crypto = require('crypto');

const generateId = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}`);
const DEFAULT_FAVORITE_ICON = favorites.defaultIcon;

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
    if (version < 3) {
      console.log('[DB Migration] Migrating to v3: Email-centric authentication...');

      // Create new tables
      db.exec(`
        CREATE TABLE users_new (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          email_verified INTEGER DEFAULT 0,
          username TEXT,
          display_name TEXT,
          roles TEXT DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE auth_methods (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          method_type TEXT NOT NULL CHECK(method_type IN ('local_password', 'oidc')),
          password_hash TEXT,
          password_algo TEXT DEFAULT 'bcrypt',
          provider_issuer TEXT,
          provider_sub TEXT,
          provider_name TEXT,
          enabled INTEGER DEFAULT 1,
          last_used_at TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users_new(id) ON DELETE CASCADE
        );
      `);

      // Migrate existing users
      const existingUsers = db.prepare('SELECT * FROM users').all();
      const preMigrationLocalCount = existingUsers.filter(u => u.provider === 'local').length;
      const insertUser = db.prepare(`
        INSERT INTO users_new (id, email, email_verified, username, display_name, roles, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertAuth = db.prepare(`
        INSERT INTO auth_methods (id, user_id, method_type, password_hash, password_algo,
                                   provider_issuer, provider_sub, provider_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      console.log(`[DB Migration] Migrating ${existingUsers.length} users...`);

      for (const user of existingUsers) {
        // Generate email if missing (for old local users without email)
        const email = user.email || `${user.username || user.id}@example.local`;
        const emailVerified = user.email ? 1 : 0;

        // Insert user identity
        insertUser.run(
          user.id,
          email,
          emailVerified,
          user.username,
          user.display_name,
          user.roles,
          user.created_at,
          user.updated_at
        );

        // Insert auth method
        if (user.provider === 'local') {
          insertAuth.run(
            generateId(),
            user.id,
            'local_password',
            user.password_hash,
            user.password_algo || 'bcrypt',
            null, null, null,
            user.created_at
          );
        } else if (user.provider === 'oidc') {
          insertAuth.run(
            generateId(),
            user.id,
            'oidc',
            null, null,
            user.oidc_issuer,
            user.oidc_sub,
            'OIDC',
            user.created_at
          );
        }
      }

      // Replace old table with new one
      db.exec(`
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
        CREATE INDEX idx_users_email ON users(email);
        CREATE INDEX idx_auth_methods_user ON auth_methods(user_id);
        CREATE UNIQUE INDEX idx_auth_methods_oidc ON auth_methods(provider_issuer, provider_sub) WHERE method_type = 'oidc';
        CREATE INDEX idx_auth_methods_type ON auth_methods(method_type);
      `);

      console.log('[DB Migration] Migration to v3 completed successfully!');
      db.prepare('INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)').run('schema_version', String(3));
      // Set a one-time announcement flag if there were any local users migrated
      try {
        if (preMigrationLocalCount > 0) {
          const notice = JSON.stringify({ 
            pending: true, 
            localMigrated: preMigrationLocalCount, 
            createdAt: new Date().toISOString() }
          );
          db.prepare('INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)').run('notice_migration_v3', notice);
        }
      } catch (_) {
        // non-fatal
      }
      version = 3;
    }
    if (version < 4) {
      console.log('[DB Migration] Migrating to v4: Adding favorites table...');

      db.exec(`
        CREATE TABLE favorites (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          path TEXT NOT NULL,
          label TEXT,
          icon TEXT DEFAULT '${DEFAULT_FAVORITE_ICON.replace(/'/g, "''")}',
          color TEXT DEFAULT NULL,
          position INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX idx_favorites_user_path ON favorites(user_id, path);
        CREATE INDEX idx_favorites_user ON favorites(user_id);
      `);

      // Migrate existing favorites from app-config.json to SQLite
      migrateFavoritesFromJson(db);

      console.log('[DB Migration] Migration to v4 completed successfully!');
      db.prepare('INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)').run('schema_version', String(4));
      version = 4;
    }
  })();
};

/**
 * Migrate favorites from app-config.json to SQLite
 */
const migrateFavoritesFromJson = (db) => {
  try {
    const jsonStoragePath = files.passwordConfig;

    // Check if app-config.json exists
    if (!fs.existsSync(jsonStoragePath)) {
      console.log('[DB Migration] No app-config.json found, skipping favorites migration');
      return;
    }

    const configData = JSON.parse(fs.readFileSync(jsonStoragePath, 'utf8'));
    const oldFavorites = configData.favorites || [];

    if (oldFavorites.length === 0) {
      console.log('[DB Migration] No favorites to migrate');
      return;
    }

    // Get all users from database
    const users = db.prepare('SELECT id FROM users').all();

    if (users.length === 0) {
      console.log('[DB Migration] No users found, skipping favorites migration');
      return;
    }

    // If there's only one user, assign all favorites to them
    // If multiple users, assign to the first user (admin)
    const targetUserId = users[0].id;

    const insertFavorite = db.prepare(`
      INSERT INTO favorites (id, user_id, path, label, icon, created_at, updated_at, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    let migratedCount = 0;

    for (const [index, fav] of oldFavorites.entries()) {
      if (!fav.path) continue;

      try {
        insertFavorite.run(
          generateId(),
          targetUserId,
          fav.path,
          fav.label || null, // Use existing label if present
          fav.icon || DEFAULT_FAVORITE_ICON,
          now,
          now,
          index
        );
        migratedCount++;
      } catch (err) {
        // Skip duplicates or invalid entries
        console.log(`[DB Migration] Skipping favorite ${fav.path}: ${err.message}`);
      }
    }

    console.log(`[DB Migration] Migrated ${migratedCount} favorites to user ${targetUserId}`);

    // Clear favorites from app-config.json
    configData.favorites = [];
    fs.writeFileSync(jsonStoragePath, JSON.stringify(configData, null, 2) + '\n', 'utf8');
    console.log('[DB Migration] Cleared favorites from app-config.json');

  } catch (err) {
    console.error('[DB Migration] Error migrating favorites:', err);
    // Non-fatal, continue
  }
};

/**
 * Ensure the anonymous user exists in the database
 * This user is used when AUTH_ENABLED=false to provide user context for features like favorites
 */
const ensureAnonymousUser = (db) => {
  try {
    const { auth } = require('../config/index');

    // Only create anonymous user when auth is disabled
    if (auth.enabled !== false) {
      return;
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE id = ?').get('anonymous');

    if (!existingUser) {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO users (id, email, email_verified, username, display_name, roles, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'anonymous',
        'anonymous@local',
        1,
        'anonymous',
        'Anonymous User',
        '[]',
        now,
        now
      );
      console.log('[DB] Created anonymous user for AUTH_ENABLED=false mode');
    }
  } catch (err) {
    console.error('[DB] Error ensuring anonymous user:', err);
    // Non-fatal, continue
  }
};

const getDb = async () => {
  if (dbInstance) return dbInstance;

  const dbDir = directories.config;
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
  ensureAnonymousUser(db);
  dbInstance = db;
  return dbInstance;
};

module.exports = {
  getDb,
  getDbPath,
};

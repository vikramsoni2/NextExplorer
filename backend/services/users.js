const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const { getDb } = require('./db');
const { auth: envAuthConfig } = require('../config/index');

const nowIso = () => new Date().toISOString();

const toClientUser = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    username: row.username,
    displayName: row.display_name || null,
    email: row.email || null,
    roles: (() => { try { return JSON.parse(row.roles || '[]'); } catch { return []; } })(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const generateId = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}`);

const normalizeUsername = (u) => (typeof u === 'string' ? u.trim().toLowerCase() : '');

// Lockout policy
const MAX_FAILED_ATTEMPTS = Number(process.env.AUTH_MAX_FAILED || 5);
const LOCKOUT_MINUTES = Number(process.env.AUTH_LOCK_MINUTES || 15);

const getLock = async (key) => {
  const db = await getDb();
  return db.prepare('SELECT failed_count, locked_until FROM auth_locks WHERE key = ?').get(key) || { failed_count: 0, locked_until: null };
};

const setLock = async (key, failedCount, lockedUntil) => {
  const db = await getDb();
  db.prepare('INSERT INTO auth_locks(key, failed_count, locked_until) VALUES(?, ?, ?) ON CONFLICT(key) DO UPDATE SET failed_count = excluded.failed_count, locked_until = excluded.locked_until').run(key, failedCount, lockedUntil);
};

const clearLock = async (key) => setLock(key, 0, null);

const isLocked = async (key) => {
  const row = await getLock(key);
  if (!row.locked_until) return false;
  const until = new Date(row.locked_until).getTime();
  return Number.isFinite(until) && Date.now() < until;
};

const countLocalUsers = async () => {
  const db = await getDb();
  const row = db.prepare("SELECT COUNT(*) as c FROM users WHERE provider='local'").get();
  return Number(row?.c || 0);
};

// Count users that currently have the admin role
const countAdmins = async () => {
  const db = await getDb();
  const rows = db.prepare('SELECT roles FROM users').all();
  let count = 0;
  for (const r of rows) {
    try {
      const roles = JSON.parse(r.roles || '[]');
      if (Array.isArray(roles) && roles.includes('admin')) count++;
    } catch (_) { /* ignore */ }
  }
  return count;
};

const getById = async (id) => {
  const db = await getDb();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return toClientUser(row);
};

const getByUsername = async (username) => {
  const db = await getDb();
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(normalizeUsername(username));
  return row || null;
};

const getByOidc = async ({ issuer, sub }) => {
  const db = await getDb();
  const row = db.prepare('SELECT * FROM users WHERE provider = ? AND oidc_issuer = ? AND oidc_sub = ?').get('oidc', issuer, sub);
  return row || null;
};

const createLocal = async ({ username, password, roles = [] }) => {
  const db = await getDb();
  const normalized = normalizeUsername(username);
  if (!normalized) {
    const e = new Error('Username is required');
    e.status = 400;
    throw e;
  }
  if (typeof password !== 'string' || password.length < 6) {
    const e = new Error('Password must be at least 6 characters long.');
    e.status = 400;
    throw e;
  }
  const exists = db.prepare('SELECT 1 FROM users WHERE username = ?').get(normalized);
  if (exists) {
    const e = new Error('A user with that username already exists.');
    e.status = 409;
    throw e;
  }

  const hash = bcrypt.hashSync(password, 12);
  const id = generateId();
  const now = nowIso();
  const rolesJson = JSON.stringify(Array.isArray(roles) ? roles : []);
  db.prepare(`
    INSERT INTO users(id, provider, username, password_hash, password_algo, roles, created_at, updated_at)
    VALUES(?, 'local', ?, ?, 'bcrypt', ?, ?, ?)
  `).run(id, normalized, hash, rolesJson, now, now);

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return toClientUser(row);
};

const verifyLocalCredentials = async ({ username, password }) => {
  const db = await getDb();
  const row = db.prepare('SELECT * FROM users WHERE provider = ? AND username = ?').get('local', normalizeUsername(username));
  if (!row || !row.password_hash) return null;
  const ok = bcrypt.compareSync(password || '', row.password_hash);
  if (!ok) return null;
  return toClientUser(row);
};

const attemptLocalLogin = async ({ username, password }) => {
  const norm = normalizeUsername(username);
  if (await isLocked(norm)) {
    const lock = await getLock(norm);
    const until = lock.locked_until || null;
    const err = new Error('Account is temporarily locked due to failed login attempts.');
    err.status = 423;
    err.until = until;
    throw err;
  }

  const user = await verifyLocalCredentials({ username: norm, password });
  if (user) {
    await clearLock(norm);
    return user;
  }

  const current = await getLock(norm);
  const failed = (Number(current.failed_count) || 0) + 1;
  let lockedUntil = null;
  if (failed >= MAX_FAILED_ATTEMPTS) {
    lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
  }
  await setLock(norm, failed % MAX_FAILED_ATTEMPTS, lockedUntil);
  return null;
};

const changeLocalPassword = async ({ userId, currentPassword, newPassword }) => {
  const db = await getDb();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!row || row.provider !== 'local') {
    const e = new Error('Password change is only allowed for local users.');
    e.status = 400;
    throw e;
  }
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    const e = new Error('Password must be at least 6 characters long.');
    e.status = 400;
    throw e;
  }
  if (!bcrypt.compareSync(currentPassword || '', row.password_hash)) {
    const e = new Error('Current password is incorrect.');
    e.status = 401;
    throw e;
  }
  const hash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hash, nowIso(), userId);
  return true;
};

// Admin path: set a local user's password without current password
const setLocalPasswordAdmin = async ({ userId, newPassword }) => {
  const db = await getDb();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!row) {
    const e = new Error('User not found.');
    e.status = 404;
    throw e;
  }
  if (row.provider !== 'local') {
    const e = new Error('Password reset is only allowed for local users.');
    e.status = 400;
    throw e;
  }
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    const e = new Error('Password must be at least 6 characters long.');
    e.status = 400;
    throw e;
  }
  const hash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hash, nowIso(), userId);
  return true;
};

// Map provider claims/groups to an app roles array
const deriveRolesFromClaims = (claims = {}, adminGroups = []) => {
  try {
    const groups = []
      .concat(Array.isArray(claims.groups) ? claims.groups : [])
      .concat(Array.isArray(claims.roles) ? claims.roles : [])
      .concat(Array.isArray(claims.entitlements) ? claims.entitlements : [])
      .filter((g) => typeof g === 'string' && g.trim())
      .map((g) => g.trim().toLowerCase());

    const cfgAdmin = Array.isArray(adminGroups)
      ? adminGroups.map((g) => (typeof g === 'string' ? g.trim().toLowerCase() : '')).filter(Boolean)
      : [];
    const isAdmin = cfgAdmin.some((g) => groups.includes(g));
    return isAdmin ? ['admin'] : ['user'];
  } catch (_) {
    return ['user'];
  }
};

const createOrUpdateOidcUser = async ({ issuer, sub, username, displayName, email, roles = [] }) => {
  const db = await getDb();
  const existing = db.prepare('SELECT * FROM users WHERE provider = ? AND oidc_issuer = ? AND oidc_sub = ?').get('oidc', issuer, sub);
  const now = nowIso();
  const rolesJson = JSON.stringify(Array.isArray(roles) ? roles : []);
  if (existing) {
    db.prepare(`
      UPDATE users
      SET username = COALESCE(?, username), display_name = COALESCE(?, display_name), email = COALESCE(?, email), roles = ?, updated_at = ?
      WHERE id = ?
    `).run(normalizeUsername(username) || existing.username, displayName || existing.display_name, email || existing.email, existing.roles === '["admin"]' ? existing.roles : rolesJson, now, existing.id);
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);
    return toClientUser(row);
  }
  const id = generateId();
  db.prepare(`
    INSERT INTO users(id, provider, username, oidc_issuer, oidc_sub, display_name, email, roles, created_at, updated_at)
    VALUES(?, 'oidc', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, normalizeUsername(username) || `oidc-${sub}`, issuer, sub, displayName || null, email || null, rolesJson, now, now);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return toClientUser(row);
};

const getRequestUser = async (req) => {
  // Local session
  if (req?.session?.localUserId) {
    const db = await getDb();
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.localUserId);
    return toClientUser(row);
  }
  // OIDC mapped user
  if (req?.oidc && typeof req.oidc.isAuthenticated === 'function' && req.oidc.isAuthenticated() && req.oidc.user?.sub) {
    const issuer = (envAuthConfig && envAuthConfig.oidc && envAuthConfig.oidc.issuer) || null;
    if (!issuer) return null;
    const db = await getDb();
    const row = db.prepare('SELECT * FROM users WHERE provider = ? AND oidc_issuer = ? AND oidc_sub = ?').get('oidc', issuer, req.oidc.user.sub);
    const mapped = toClientUser(row);
    if (mapped) return mapped;
    // Fallback: derive a minimal user object from OIDC claims when DB sync hasn't happened yet
    try {
      const claims = req.oidc.user || {};
      const email = claims.email || null;
      const preferredUsername = claims.preferred_username || claims.username || email || claims.sub;
      const displayName = claims.name || preferredUsername || null;
      const roles = deriveRolesFromClaims(claims, envAuthConfig?.oidc?.adminGroups);

      return {
        id: `oidc:${claims.sub}`,
        provider: 'oidc',
        username: normalizeUsername(preferredUsername),
        displayName,
        email,
        roles,
        createdAt: null,
        updatedAt: null,
      };
    } catch (_) {
      return null;
    }
  }
  return null;
};

const listUsers = async () => {
  const db = await getDb();
  const rows = db.prepare('SELECT * FROM users ORDER BY created_at ASC').all();
  return rows.map((r) => toClientUser(r));
};

const updateUserRoles = async ({ userId, roles }) => {
  const db = await getDb();
  const r = Array.isArray(roles) ? roles.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : [];
  const json = JSON.stringify(r);
  db.prepare('UPDATE users SET roles = ?, updated_at = ? WHERE id = ?').run(json, nowIso(), userId);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  return toClientUser(row);
};

const deleteUser = async ({ userId }) => {
  const db = await getDb();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!row) {
    return false;
  }
  // Only allow removing local users through this path
  if (row.provider !== 'local') {
    const e = new Error('Only local users can be removed.');
    e.status = 400;
    throw e;
  }
  // Prevent removing the last admin
  try {
    const roles = JSON.parse(row.roles || '[]');
    if (Array.isArray(roles) && roles.includes('admin')) {
      const admins = await countAdmins();
      if (admins <= 1) {
        const e = new Error('Cannot remove the last admin.');
        e.status = 400;
        throw e;
      }
    }
  } catch (_) { /* ignore parse */ }

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  return true;
};

module.exports = {
  countLocalUsers,
  countAdmins,
  getById,
  getByUsername,
  getByOidc,
  createLocal,
  verifyLocalCredentials,
  createOrUpdateOidcUser,
  attemptLocalLogin,
  changeLocalPassword,
  setLocalPasswordAdmin,
  getRequestUser,
  listUsers,
  updateUserRoles,
  deriveRolesFromClaims,
  deleteUser,
};

const bcrypt = require('bcryptjs');
const { getDb } = require('../db');
const logger = require('../../utils/logger');
const { nowIso, toClientUser, generateId, normalizeEmail } = require('./utils');
const { isLocked, incrementFailedAttempts, clearLock, getLock } = require('./lockout');
const { NotFoundError, UnauthorizedError, ValidationError } = require('../../errors/AppError');

// Attempt local login with email + password
const attemptLocalLogin = async ({ email, password }) => {
  const normEmail = normalizeEmail(email);

  // Check lockout
  if (await isLocked(normEmail)) {
    const lock = await getLock(normEmail);
    const until = lock.locked_until || null;
    const err = new Error('Account is temporarily locked due to failed login attempts.');
    err.status = 423;
    err.until = until;
    throw err;
  }

  const db = await getDb();

  // Find user by email
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normEmail);
  if (!user) {
    await incrementFailedAttempts(normEmail);
    return null;
  }

  // Find local password auth method
  const authMethod = db
    .prepare(
      `
    SELECT * FROM auth_methods
    WHERE user_id = ? AND method_type = 'local_password' AND enabled = 1
  `
    )
    .get(user.id);

  if (!authMethod || !authMethod.password_hash) {
    await incrementFailedAttempts(normEmail);
    return null;
  }

  // Verify password
  const valid = bcrypt.compareSync(password || '', authMethod.password_hash);
  if (!valid) {
    await incrementFailedAttempts(normEmail);
    return null;
  }

  // Success - clear lockout
  await clearLock(normEmail);
  db.prepare('UPDATE auth_methods SET last_used_at = ? WHERE id = ?').run(nowIso(), authMethod.id);

  let clientUser = toClientUser(user);
  if (clientUser) {
    clientUser.provider = 'local';
  }
  return clientUser;
};

// Create user with local password authentication
const createLocalUser = async ({ email, password, username, displayName, roles = ['user'] }) => {
  const db = await getDb();
  const normEmail = normalizeEmail(email);

  if (!normEmail) {
    const e = new Error('Email is required');
    e.status = 400;
    throw e;
  }

  if (!password || password.length < 6) {
    const e = new Error('Password must be at least 6 characters long');
    e.status = 400;
    throw e;
  }

  // Check if user exists
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(normEmail);

  if (user) {
    // User exists - check if they already have local password
    const existingAuth = db
      .prepare(
        `
      SELECT id FROM auth_methods
      WHERE user_id = ? AND method_type = 'local_password'
    `
      )
      .get(user.id);

    if (existingAuth) {
      const e = new Error('User already has local password authentication');
      e.status = 409;
      throw e;
    }

    // Auto-link: Add password auth to existing user
    logger.info({ email: user.email }, '[Auth] Adding password auth to existing user');

    const hash = bcrypt.hashSync(password, 12);
    const authId = generateId();

    db.prepare(
      `
      INSERT INTO auth_methods (id, user_id, method_type, password_hash, password_algo, created_at)
      VALUES (?, ?, 'local_password', ?, 'bcrypt', ?)
    `
    ).run(authId, user.id, hash, nowIso());

    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    return toClientUser(user);
  }

  // New user: Create user and password auth
  const userId = generateId();
  const now = nowIso();
  const rolesJson = JSON.stringify(Array.isArray(roles) ? roles : ['user']);
  const hash = bcrypt.hashSync(password, 12);

  // Create user
  db.prepare(
    `
    INSERT INTO users (id, email, email_verified, username, display_name, roles, created_at, updated_at)
    VALUES (?, ?, 0, ?, ?, ?, ?, ?)
  `
  ).run(userId, normEmail, username, displayName, rolesJson, now, now);

  // Create password auth method
  const authId = generateId();
  db.prepare(
    `
    INSERT INTO auth_methods (id, user_id, method_type, password_hash, password_algo, created_at)
    VALUES (?, ?, 'local_password', ?, 'bcrypt', ?)
  `
  ).run(authId, userId, hash, now);

  user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  return toClientUser(user);
};

// Change password for user with local password auth
const changeLocalPassword = async ({ userId, currentPassword, newPassword }) => {
  const db = await getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    throw new NotFoundError('User not found.');
  }

  // Check if user has local password auth
  const authMethod = db
    .prepare(
      `
    SELECT * FROM auth_methods
    WHERE user_id = ? AND method_type = 'local_password' AND enabled = 1
  `
    )
    .get(userId);

  if (!authMethod || !authMethod.password_hash) {
    throw new ValidationError(
      'Password change is only allowed for users with password authentication.'
    );
  }

  if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
    throw new ValidationError('Current password is required.');
  }

  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    throw new ValidationError('Password must be at least 6 characters long.');
  }

  if (!bcrypt.compareSync(currentPassword, authMethod.password_hash)) {
    throw new UnauthorizedError('Current password is incorrect.');
  }

  const hash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE auth_methods SET password_hash = ? WHERE id = ?').run(hash, authMethod.id);
  return true;
};

// Admin path: set a local user's password without current password
const setLocalPasswordAdmin = async ({ userId, newPassword }) => {
  const db = await getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    const e = new Error('User not found.');
    e.status = 404;
    throw e;
  }

  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    const e = new Error('Password must be at least 6 characters long.');
    e.status = 400;
    throw e;
  }

  const hash = bcrypt.hashSync(newPassword, 12);

  // Check if user has local password auth
  const authMethod = db
    .prepare(
      `
    SELECT id FROM auth_methods
    WHERE user_id = ? AND method_type = 'local_password'
  `
    )
    .get(userId);

  if (authMethod) {
    // Update existing password
    db.prepare('UPDATE auth_methods SET password_hash = ? WHERE id = ?').run(hash, authMethod.id);
  } else {
    // Create new password auth method
    const authId = generateId();
    db.prepare(
      `
      INSERT INTO auth_methods (id, user_id, method_type, password_hash, password_algo, created_at)
      VALUES (?, ?, 'local_password', ?, 'bcrypt', ?)
    `
    ).run(authId, userId, hash, nowIso());
  }

  return true;
};

// Add password auth to existing user (for OIDC-only users)
const addLocalPassword = async ({ userId, password }) => {
  const db = await getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    const e = new Error('User not found.');
    e.status = 404;
    throw e;
  }

  // Check if user already has password auth
  const existing = db
    .prepare(
      `
    SELECT id FROM auth_methods
    WHERE user_id = ? AND method_type = 'local_password'
  `
    )
    .get(userId);

  if (existing) {
    const e = new Error('You already have password authentication.');
    e.status = 409;
    throw e;
  }

  if (!password || password.length < 6) {
    const e = new Error('Password must be at least 6 characters long.');
    e.status = 400;
    throw e;
  }

  const hash = bcrypt.hashSync(password, 12);
  const authId = generateId();

  db.prepare(
    `
    INSERT INTO auth_methods (id, user_id, method_type, password_hash, password_algo, created_at)
    VALUES (?, ?, 'local_password', ?, 'bcrypt', ?)
  `
  ).run(authId, userId, hash, nowIso());

  return true;
};

module.exports = {
  attemptLocalLogin,
  createLocalUser,
  changeLocalPassword,
  setLocalPasswordAdmin,
  addLocalPassword,
};

const { directories, auth } = require('../config/index');
const env = require('../config/env');
const { ensureDir } = require('./fsUtils');
const logger = require('./logger');
const {
  getByEmail,
  createLocalUser,
  setLocalPasswordAdmin,
  updateUserRoles,
} = require('../services/users');

const supportsLocalAuth = () => {
  const mode = auth?.mode || 'both';
  return mode === 'local' || mode === 'both';
};

const ensureEnvAdminUser = async () => {
  const email = typeof env.AUTH_ADMIN_EMAIL === 'string' ? env.AUTH_ADMIN_EMAIL.trim() : '';
  const password = typeof env.AUTH_ADMIN_PASSWORD === 'string' ? env.AUTH_ADMIN_PASSWORD : '';

  if (!email && !password) return;

  if (!auth?.enabled) {
    logger.info('AUTH_ADMIN_* provided but auth is disabled; skipping admin bootstrap.');
    return;
  }

  if (!supportsLocalAuth()) {
    logger.info({ authMode: auth?.mode }, 'AUTH_ADMIN_* provided but local auth is disabled; skipping admin bootstrap.');
    return;
  }

  if (!email || !password) {
    logger.warn('AUTH_ADMIN_EMAIL and AUTH_ADMIN_PASSWORD must both be set to bootstrap an admin user.');
    return;
  }

  if (password.length < 6) {
    logger.warn('AUTH_ADMIN_PASSWORD must be at least 6 characters; skipping admin bootstrap.');
    return;
  }

  const normalizedEmail = email.toLowerCase();
  const username = normalizedEmail.split('@')[0] || 'admin';

  const ensureAdminRole = async (userId, rolesJson) => {
    let roles = [];
    try { roles = JSON.parse(rolesJson || '[]'); } catch (_) { roles = []; }
    if (!Array.isArray(roles)) roles = [];
    if (!roles.includes('admin')) {
      await updateUserRoles({ userId, roles: [...new Set([...roles, 'admin'])] });
    }
  };

  try {
    const existing = await getByEmail(normalizedEmail);
    if (!existing) {
      try {
        const user = await createLocalUser({
          email: normalizedEmail,
          password,
          username,
          displayName: username,
          roles: ['admin'],
        });
        logger.info({ email: user.email }, 'Bootstrapped admin user from environment.');
        return;
      } catch (e) {
        // Race/replica-safe: if another instance created the user already, fall through to update.
        if (e?.status !== 409) throw e;
      }
    }

    const user = await getByEmail(normalizedEmail);
    if (!user) {
      logger.warn({ email: normalizedEmail }, 'Unable to locate admin user after bootstrap attempt; skipping.');
      return;
    }

    await ensureAdminRole(user.id, user.roles);
    await setLocalPasswordAdmin({ userId: user.id, newPassword: password });
    logger.info({ email: normalizedEmail }, 'Ensured admin user password from environment.');
  } catch (error) {
    logger.warn({ err: error }, 'Failed to bootstrap admin user from environment.');
  }
};

const bootstrap = async () => {
  logger.debug('Bootstrap start');

  const dirEntries = [
    ['config', directories.config],
    ['cache', directories.cache],
    ['thumbnails', directories.thumbnails],
  ];

  await Promise.all(dirEntries.map(async ([name, dir]) => {
    try {
      await ensureDir(dir);
      logger.debug({ dir }, `${name} directory ensured`);
    } catch (error) {
      logger.warn({ directory: dir, err: error }, `Unable to prepare ${name} directory`);
    }
  }));

  await ensureEnvAdminUser();
  logger.debug('Bootstrap complete');
};

module.exports = { bootstrap };

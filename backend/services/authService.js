const crypto = require('crypto');

const { directories, auth: envAuthConfig } = require('../config/index');
const { ensureDir } = require('../utils/fsUtils');
const {
  DEFAULT_ITERATIONS,
  getAuthConfig,
  setAuthConfig,
  getSettings,
} = require('./appConfigService');
const {
  listUsers,
  findByUsername,
  findById,
  createLocalUser,
  updateUser,
} = require('./userStore');

const HASH_ALGORITHM = 'sha512';
const DERIVED_KEY_LENGTH = 64;
const SESSION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

let hasLocalCredentials = false;
const activeTokens = new Map(); // token -> { userId, expiresAt }
let initialized = false;

const deriveKey = (password, salt, iterations) => new Promise((resolve, reject) => {
  crypto.pbkdf2(password, salt, iterations, DERIVED_KEY_LENGTH, HASH_ALGORITHM, (error, derivedKey) => {
    if (error) {
      reject(error);
      return;
    }
    resolve(derivedKey.toString('hex'));
  });
});

const hashPassword = async (password, iterations = DEFAULT_ITERATIONS) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = await deriveKey(password, salt, iterations);
  return { passwordHash, salt, iterations };
};

const pruneExpiredTokens = () => {
  const now = Date.now();
  for (const [token, entry] of activeTokens.entries()) {
    if (!entry || typeof entry.expiresAt !== 'number' || entry.expiresAt <= now) {
      activeTokens.delete(token);
    }
  }
};

const createSessionToken = (userId) => {
  pruneExpiredTokens();
  const token = crypto.randomBytes(32).toString('hex');
  activeTokens.set(token, {
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + SESSION_TOKEN_TTL_MS,
  });
  return token;
};

const isSessionTokenValid = (token) => {
  pruneExpiredTokens();
  if (!token) {
    return false;
  }
  const entry = activeTokens.get(token);
  return Boolean(entry && typeof entry.expiresAt === 'number' && entry.expiresAt > Date.now());
};

const getUserIdForToken = (token) => {
  pruneExpiredTokens();
  if (!token) {
    return null;
  }
  const entry = activeTokens.get(token);
  if (!entry || entry.expiresAt <= Date.now()) {
    return null;
  }
  return entry.userId || null;
};

const invalidateSessionToken = (token) => {
  if (token) {
    activeTokens.delete(token);
  }
};

const sanitizeUserForClient = (user) => {
  if (!user) {
    return null;
  }

  const {
    passwordHash,
    salt,
    iterations,
    ...rest
  } = user;

  return rest;
};

const refreshLocalCredentialFlag = async () => {
  const users = await listUsers();
  hasLocalCredentials = users.some((user) => user.provider === 'local');
};

const migrateLegacyAuthConfig = async () => {
  const authConfig = await getAuthConfig();
  const hasLegacyPassword = Boolean(authConfig.passwordHash && authConfig.salt);

  if (!hasLegacyPassword) {
    return;
  }

  const users = await listUsers();
  const hasLocalUser = users.some((user) => user.provider === 'local');

  if (hasLocalUser) {
    return;
  }

  await createLocalUser({
    username: 'admin',
    passwordHash: authConfig.passwordHash,
    salt: authConfig.salt,
    iterations: authConfig.iterations || DEFAULT_ITERATIONS,
    roles: ['admin'],
  });

  await setAuthConfig({
    passwordHash: null,
    salt: null,
    iterations: DEFAULT_ITERATIONS,
    createdAt: authConfig.createdAt || new Date().toISOString(),
  });
};

const initializeAuth = async () => {
  if (initialized) {
    return;
  }

  await ensureDir(directories.cache);
  await migrateLegacyAuthConfig();
  await refreshLocalCredentialFlag();
  initialized = true;
};

const isPasswordSet = () => hasLocalCredentials;

const createInitialUser = async ({ username, password }) => {
  if (!password || typeof password !== 'string' || password.trim().length < 6) {
    const error = new Error('Password must be at least 6 characters long.');
    error.code = 'PASSWORD_TOO_SHORT';
    throw error;
  }

  const normalizedUsername = typeof username === 'string' && username.trim()
    ? username.trim().toLowerCase()
    : 'admin';

  const users = await listUsers();
  if (users.some((user) => user.provider === 'local')) {
    const error = new Error('Local authentication has already been configured.');
    error.code = 'ALREADY_CONFIGURED';
    throw error;
  }

  const { passwordHash, salt, iterations } = await hashPassword(password);

  const user = await createLocalUser({
    username: normalizedUsername,
    passwordHash,
    salt,
    iterations,
    roles: ['admin'],
  });

  hasLocalCredentials = true;
  return sanitizeUserForClient(user);
};

const verifyLocalCredentials = async ({ username, password }) => {
  const normalizedUsername = typeof username === 'string' && username.trim()
    ? username.trim().toLowerCase()
    : null;

  if (!normalizedUsername || typeof password !== 'string' || !password) {
    return null;
  }

  const user = await findByUsername(normalizedUsername);
  if (!user || user.provider !== 'local' || !user.passwordHash || !user.salt) {
    return null;
  }

  const derived = await deriveKey(password, user.salt, user.iterations || DEFAULT_ITERATIONS);

  const expected = Buffer.from(user.passwordHash, 'hex');
  const provided = Buffer.from(derived, 'hex');

  if (expected.length !== provided.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(expected, provided)) {
    return null;
  }

  await updateUser(user.id, {
    lastLoginAt: new Date().toISOString(),
  });

  return sanitizeUserForClient(await findById(user.id));
};

const updateLocalUserPassword = async ({ userId, password }) => {
  if (!userId) {
    throw new Error('User id is required to update password.');
  }

  if (!password || typeof password !== 'string' || password.trim().length < 6) {
    const error = new Error('Password must be at least 6 characters long.');
    error.code = 'PASSWORD_TOO_SHORT';
    throw error;
  }

  const { passwordHash, salt, iterations } = await hashPassword(password);
  await updateUser(userId, {
    passwordHash,
    salt,
    iterations,
    passwordChangedAt: new Date().toISOString(),
  });
};

const getStatus = async () => {
  const settings = await getSettings();
  const security = settings?.security || {};
  const users = await listUsers();
  const envOidc = (envAuthConfig && envAuthConfig.oidc) || {};
  const oidcEnabled = envOidc.enabled != null
    ? Boolean(envOidc.enabled)
    : Boolean(security?.oidc?.enabled);

  return {
    requiresSetup: !users.some((user) => user.provider === 'local'),
    strategies: {
      local: users.some((user) => user.provider === 'local'),
      oidc: oidcEnabled,
    },
  };
};

module.exports = {
  initializeAuth,
  isPasswordSet,
  createInitialUser,
  verifyLocalCredentials,
  updateLocalUserPassword,
  createSessionToken,
  isSessionTokenValid,
  invalidateSessionToken,
  getUserIdForToken,
  getStatus,
  sanitizeUserForClient,
};

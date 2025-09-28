const crypto = require('crypto');

const { directories } = require('../config/index');
const { ensureDir } = require('../utils/fsUtils');
const {
  DEFAULT_ITERATIONS,
  getAuthConfig,
  setAuthConfig,
} = require('./appConfigService');

const HASH_ALGORITHM = 'sha512';
const DERIVED_KEY_LENGTH = 64;

let passwordConfig = {
  passwordHash: null,
  salt: null,
  iterations: DEFAULT_ITERATIONS,
  createdAt: null,
};

const activeTokens = new Set();

const deriveKey = (password, salt, iterations) => new Promise((resolve, reject) => {
  crypto.pbkdf2(password, salt, iterations, DERIVED_KEY_LENGTH, HASH_ALGORITHM, (error, derivedKey) => {
    if (error) {
      reject(error);
      return;
    }
    resolve(derivedKey.toString('hex'));
  });
});

const initializeAuth = async () => {
  await ensureDir(directories.cache);
  try {
    const authConfig = await getAuthConfig();
    passwordConfig = {
      passwordHash: authConfig.passwordHash || null,
      salt: authConfig.salt || null,
      iterations: authConfig.iterations || DEFAULT_ITERATIONS,
      createdAt: authConfig.createdAt || null,
    };
  } catch (error) {
    console.warn('Failed to load auth configuration; defaulting to setup required.', error);
    passwordConfig = {
      passwordHash: null,
      salt: null,
      iterations: DEFAULT_ITERATIONS,
      createdAt: null,
    };
  }
};

const isPasswordSet = () => Boolean(passwordConfig.passwordHash && passwordConfig.salt);

const setPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const iterations = DEFAULT_ITERATIONS;
  const passwordHash = await deriveKey(password, salt, iterations);

  passwordConfig = {
    passwordHash,
    salt,
    iterations,
    createdAt: new Date().toISOString(),
  };

  activeTokens.clear();
  await setAuthConfig(passwordConfig);
};

const verifyPassword = async (password) => {
  if (!isPasswordSet()) {
    return false;
  }

  const expectedHashHex = passwordConfig.passwordHash;
  const providedHashHex = await deriveKey(password, passwordConfig.salt, passwordConfig.iterations || DEFAULT_ITERATIONS);

  const expected = Buffer.from(expectedHashHex, 'hex');
  const provided = Buffer.from(providedHashHex, 'hex');

  if (expected.length !== provided.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, provided);
};

const createSessionToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  activeTokens.add(token);
  return token;
};

const isSessionTokenValid = (token) => activeTokens.has(token);

const invalidateSessionToken = (token) => {
  if (token) {
    activeTokens.delete(token);
  }
};

const getStatus = () => ({
  requiresSetup: !isPasswordSet(),
});

module.exports = {
  initializeAuth,
  isPasswordSet,
  setPassword,
  verifyPassword,
  createSessionToken,
  isSessionTokenValid,
  invalidateSessionToken,
  getStatus,
};

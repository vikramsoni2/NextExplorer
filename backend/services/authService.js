const fs = require('fs/promises');
const crypto = require('crypto');

const { directories, files } = require('../config/index');
const { ensureDir } = require('../utils/fsUtils');

const CONFIG_ENCODING = 'utf8';
const HASH_ALGORITHM = 'sha512';
const DERIVED_KEY_LENGTH = 64;
const DEFAULT_ITERATIONS = 210000;

const configFilePath = files.passwordConfig;

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

const writeConfig = async () => {
  const payload = {
    version: 1,
    passwordHash: passwordConfig.passwordHash,
    salt: passwordConfig.salt,
    iterations: passwordConfig.iterations,
    createdAt: passwordConfig.createdAt,
  };

  await fs.writeFile(configFilePath, `${JSON.stringify(payload, null, 2)}\n`, CONFIG_ENCODING);
};

const ensureConfigFileExists = async () => {
  try {
    await fs.access(configFilePath);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      await writeConfig();
      return;
    }
    throw error;
  }
};

const loadConfig = async () => {
  try {
    const raw = await fs.readFile(configFilePath, CONFIG_ENCODING);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      passwordConfig = {
        passwordHash: parsed.passwordHash || null,
        salt: parsed.salt || null,
        iterations: parsed.iterations || DEFAULT_ITERATIONS,
        createdAt: parsed.createdAt || null,
      };
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      await writeConfig();
      return;
    }
    console.warn('Failed to load password config, defaulting to setup required.', error);
    passwordConfig = {
      passwordHash: null,
      salt: null,
      iterations: DEFAULT_ITERATIONS,
      createdAt: null,
    };
  }
};

const initializeAuth = async () => {
  await ensureDir(directories.cache);
  await ensureConfigFileExists();
  await loadConfig();
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
  await writeConfig();
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

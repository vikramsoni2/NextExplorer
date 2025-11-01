const crypto = require('crypto');

const {
  getUsers,
  updateUsers,
} = require('./appConfigService');

const nowIso = () => new Date().toISOString();

const generateId = () => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}`;
};

const normalizeUsername = (username) => {
  if (typeof username !== 'string') {
    return '';
  }
  return username.trim().toLowerCase();
};

const listUsers = async () => {
  const users = await getUsers();
  return users.map((user) => ({ ...user }));
};

const findByUsername = async (username) => {
  const normalized = normalizeUsername(username);
  if (!normalized) {
    return null;
  }

  const users = await getUsers();
  return users.find((user) => normalizeUsername(user.username) === normalized) || null;
};

const findById = async (id) => {
  if (!id || typeof id !== 'string') {
    return null;
  }

  const users = await getUsers();
  return users.find((user) => user.id === id) || null;
};

const findByOidcSub = async ({ issuer, subject }) => {
  if (!issuer || !subject) {
    return null;
  }

  const users = await getUsers();
  return users.find(
    (user) => user.provider === 'oidc'
      && user.oidcSub === subject
      && user.oidcIssuer === issuer,
  ) || null;
};

const createLocalUser = async ({
  username,
  passwordHash,
  salt,
  iterations,
  roles = [],
  displayName = null,
  email = null,
}) => {
  const normalized = normalizeUsername(username);
  if (!normalized) {
    throw new Error('A username is required to create a user.');
  }

  if (!passwordHash || !salt) {
    throw new Error('Password hash and salt are required for local users.');
  }

  const existing = await findByUsername(normalized);
  if (existing) {
    const error = new Error('A user with that username already exists.');
    error.code = 'USER_EXISTS';
    throw error;
  }

  const now = nowIso();
  const user = {
    id: generateId(),
    username: normalized,
    provider: 'local',
    passwordHash,
    salt,
    iterations,
    roles: Array.isArray(roles) ? roles : [],
    createdAt: now,
    updatedAt: now,
    displayName,
    email,
  };

  await updateUsers((current) => [...current, user]);
  return user;
};

const createOidcUser = async ({
  issuer,
  subject,
  username,
  displayName = null,
  email = null,
  roles = [],
}) => {
  if (!issuer || !subject) {
    throw new Error('OIDC issuer and subject are required.');
  }

  const existing = await findByOidcSub({ issuer, subject });
  if (existing) {
    return existing;
  }

  const preferredUsername = normalizeUsername(username) || `oidc-${subject}`;
  const now = nowIso();
  const user = {
    id: generateId(),
    username: preferredUsername,
    provider: 'oidc',
    roles: Array.isArray(roles) ? roles : [],
    createdAt: now,
    updatedAt: now,
    displayName,
    email,
    oidcSub: subject,
    oidcIssuer: issuer,
  };

  await updateUsers((current) => [...current, user]);
  return user;
};

const updateUser = async (userId, updater) => {
  if (!userId) {
    throw new Error('User id is required to update a user.');
  }

  let updatedUser = null;

  await updateUsers((current) => current.map((user) => {
    if (user.id !== userId) {
      return user;
    }

    const next = typeof updater === 'function'
      ? updater({ ...user })
      : { ...user, ...(updater || {}) };

    updatedUser = {
      ...user,
      ...next,
      updatedAt: nowIso(),
    };
    return updatedUser;
  }));

  return updatedUser;
};

module.exports = {
  listUsers,
  findByUsername,
  findById,
  findByOidcSub,
  createLocalUser,
  createOidcUser,
  updateUser,
};

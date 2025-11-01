const crypto = require('crypto');
const { DEFAULT_ITERATIONS, getUsers, setUsers } = require('./services/appConfigService');
const { normalize } = require('path');

const username = process.argv[1];
const password = process.argv[2];

if (!username || !password) {
  console.error('Usage: node create-user.js <username> <password>');
  process.exit(1);
}

const normalizeUsername = (value) => value.trim().toLowerCase();

const hashPassword = async (plain) => new Promise((resolve, reject) => {
  const salt = crypto.randomBytes(16).toString('hex');
  crypto.pbkdf2(plain, salt, DEFAULT_ITERATIONS, 64, 'sha512', (err, derivedKey) => {
    if (err) return reject(err);
    resolve({ salt, passwordHash: derivedKey.toString('hex'), iterations: DEFAULT_ITERATIONS });
  });
});

(async () => {
  const normalized = normalizeUsername(username);
  const users = await getUsers();
  if (users.some((u) => normalizeUsername(u.username) === normalized)) {
    console.error('User already exists.');
    process.exit(1);
  }

  const { salt, passwordHash, iterations } = await hashPassword(password);
  const now = new Date().toISOString();

  const nextUsers = users.concat([{
    id: crypto.randomUUID(),
    username: normalized,
    provider: 'local',
    passwordHash,
    salt,
    iterations,
    roles: [],
    createdAt: now,
    updatedAt: now,
  }]);

  await setUsers(nextUsers);
  console.log(`Created user "${normalized}".`);
})();


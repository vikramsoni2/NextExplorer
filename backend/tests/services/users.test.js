const test = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnv } = require('../helpers/env-test-utils');

test('create local user, login, change password, and enforce lockout', async () => {
  const envContext = await setupTestEnv({
    tag: 'users-test-',
    modules: ['src/services/users', 'src/services/db'],
  });
  const users = envContext.requireFresh('src/services/users');

  try {
    // Initially no users
    assert.equal(await users.countUsers(), 0);

    // Create admin user with local password auth
    const admin = await users.createLocalUser({
      email: 'admin@example.com',
      password: 'secret123',
      username: 'admin',
      displayName: 'Admin',
      roles: ['admin'],
    });
    assert.equal(admin.username, 'admin');
    assert.equal(await users.countUsers(), 1);

    // Successful login with email + password
    const loggedIn = await users.attemptLocalLogin({
      email: 'admin@example.com',
      password: 'secret123',
    });
    assert.ok(loggedIn && loggedIn.id === admin.id);

    // Change password and verify login with the new password
    await users.changeLocalPassword({
      userId: admin.id,
      currentPassword: 'secret123',
      newPassword: 'newpass456',
    });
    const afterChange = await users.attemptLocalLogin({
      email: 'admin@example.com',
      password: 'newpass456',
    });
    assert.ok(afterChange && afterChange.id === admin.id);

    // Wrong password attempts trigger lockout based on email
    for (let i = 0; i < 5; i++) {
      const bad = await users.attemptLocalLogin({
        email: 'admin@example.com',
        password: 'nope',
      });
      assert.equal(bad, null);
    }

    // Next attempt should throw 423 lockout
    await assert.rejects(
      () => users.attemptLocalLogin({ email: 'admin@example.com', password: 'nope' }),
      (err) => err && err.status === 423,
    );
  } finally {
    await envContext.cleanup();
  }
});

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

test('OIDC: deny login when auto-create disabled and user missing', async () => {
  const envContext = await setupTestEnv({
    tag: 'users-oidc-no-autocreate-',
    modules: ['src/services/users', 'src/services/db'],
    env: { OIDC_AUTO_CREATE_USERS: 'false' },
  });
  const users = envContext.requireFresh('src/services/users');

  try {
    await assert.rejects(
      () => users.getOrCreateOidcUser({
        issuer: 'https://issuer.example.com',
        sub: 'sub-1',
        email: 'missing@example.com',
        emailVerified: true,
        username: 'missing',
        displayName: 'Missing',
        roles: ['user'],
        autoCreateUsers: false,
      }),
      (err) => err && err.statusCode === 403,
    );
  } finally {
    await envContext.cleanup();
  }
});

test('OIDC: auto-link to existing local user even when auto-create disabled', async () => {
  const envContext = await setupTestEnv({
    tag: 'users-oidc-autolink-',
    modules: ['src/services/users', 'src/services/db'],
    env: { OIDC_AUTO_CREATE_USERS: 'false' },
  });
  const users = envContext.requireFresh('src/services/users');

  try {
    const existing = await users.createLocalUser({
      email: 'existing@example.com',
      password: 'secret123',
      username: 'existing',
      displayName: 'Existing',
      roles: ['user'],
    });

    const linked = await users.getOrCreateOidcUser({
      issuer: 'https://issuer.example.com',
      sub: 'sub-2',
      email: 'existing@example.com',
      emailVerified: true,
      username: 'existing-oidc',
      displayName: 'Existing OIDC',
      roles: ['user'],
      autoCreateUsers: false,
    });
    assert.equal(linked.id, existing.id);

    const methods = await users.getUserAuthMethods(existing.id);
    const hasOidc = methods.some((m) => m.method_type === 'oidc' && m.provider_sub === 'sub-2');
    assert.equal(hasOidc, true);
  } finally {
    await envContext.cleanup();
  }
});

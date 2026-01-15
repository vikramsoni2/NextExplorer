const test = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnv } = require('../helpers/env-test-utils');

test('searchUsersForMentions returns empty for empty query', async () => {
  const envContext = await setupTestEnv({
    tag: 'userSearch-empty-',
    modules: ['src/services/userSearchService', 'src/services/db'],
  });
  const { searchUsersForMentions } = envContext.requireFresh('src/services/userSearchService');

  try {
    const result = await searchUsersForMentions('');
    assert.deepEqual(result, { Users: [] });

    const resultNull = await searchUsersForMentions(null);
    assert.deepEqual(resultNull, { Users: [] });

    const resultWhitespace = await searchUsersForMentions('   ');
    assert.deepEqual(resultWhitespace, { Users: [] });
  } finally {
    await envContext.cleanup();
  }
});

test('searchUsersForMentions finds users by display name, email, and username', async () => {
  const envContext = await setupTestEnv({
    tag: 'userSearch-find-',
    modules: ['src/services/userSearchService', 'src/services/users', 'src/services/db'],
  });
  const { searchUsersForMentions } = envContext.requireFresh('src/services/userSearchService');
  const users = envContext.requireFresh('src/services/users');

  try {
    // Create test users
    await users.createLocalUser({
      email: 'john.doe@example.com',
      password: 'password123',
      username: 'johnd',
      displayName: 'John Doe',
      roles: ['user'],
    });

    await users.createLocalUser({
      email: 'jane.smith@example.com',
      password: 'password123',
      username: 'janes',
      displayName: 'Jane Smith',
      roles: ['user'],
    });

    // Search by display name
    const byName = await searchUsersForMentions('John', 10);
    assert.equal(byName.Users.length, 1);
    assert.equal(byName.Users[0].UserFriendlyName, 'John Doe');
    assert.equal(byName.Users[0].UserEmail, 'john.doe@example.com');

    // Search by email
    const byEmail = await searchUsersForMentions('jane.smith@', 10);
    assert.equal(byEmail.Users.length, 1);
    assert.equal(byEmail.Users[0].UserEmail, 'jane.smith@example.com');

    // Search by username
    const byUsername = await searchUsersForMentions('johnd', 10);
    assert.equal(byUsername.Users.length, 1);
    assert.equal(byUsername.Users[0].UserFriendlyName, 'John Doe');
  } finally {
    await envContext.cleanup();
  }
});

test('searchUsersForMentions is case insensitive', async () => {
  const envContext = await setupTestEnv({
    tag: 'userSearch-case-',
    modules: ['src/services/userSearchService', 'src/services/users', 'src/services/db'],
  });
  const { searchUsersForMentions } = envContext.requireFresh('src/services/userSearchService');
  const users = envContext.requireFresh('src/services/users');

  try {
    await users.createLocalUser({
      email: 'alice@example.com',
      password: 'password123',
      username: 'alice',
      displayName: 'Alice Anderson',
      roles: ['user'],
    });

    // Search with different cases
    const upper = await searchUsersForMentions('ALICE', 10);
    assert.equal(upper.Users.length, 1);

    const lower = await searchUsersForMentions('alice', 10);
    assert.equal(lower.Users.length, 1);

    const mixed = await searchUsersForMentions('AlIcE', 10);
    assert.equal(mixed.Users.length, 1);
  } finally {
    await envContext.cleanup();
  }
});

test('searchUsersForMentions respects limit parameter', async () => {
  const envContext = await setupTestEnv({
    tag: 'userSearch-limit-',
    modules: ['src/services/userSearchService', 'src/services/users', 'src/services/db'],
  });
  const { searchUsersForMentions } = envContext.requireFresh('src/services/userSearchService');
  const users = envContext.requireFresh('src/services/users');

  try {
    // Create multiple users with similar names
    for (let i = 1; i <= 10; i++) {
      await users.createLocalUser({
        email: `testuser${i}@example.com`,
        password: 'password123',
        username: `testuser${i}`,
        displayName: `Test User ${i}`,
        roles: ['user'],
      });
    }

    // Search with limit
    const limited = await searchUsersForMentions('Test User', 3);
    assert.equal(limited.Users.length, 3);

    const unlimited = await searchUsersForMentions('Test User', 20);
    assert.equal(unlimited.Users.length, 10);
  } finally {
    await envContext.cleanup();
  }
});

test('searchUsersForMentions falls back to username when display_name is missing', async () => {
  const envContext = await setupTestEnv({
    tag: 'userSearch-fallback-',
    modules: ['src/services/userSearchService', 'src/services/db'],
  });
  const { searchUsersForMentions } = envContext.requireFresh('src/services/userSearchService');
  const { getDb } = envContext.requireFresh('src/services/db');

  try {
    // Insert user directly without display_name
    const db = await getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO users (id, email, username, display_name, roles, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('user-no-display', 'nodisplay@example.com', 'nodisplayuser', null, '["user"]', now, now);

    const result = await searchUsersForMentions('nodisplay', 10);
    assert.equal(result.Users.length, 1);
    assert.equal(result.Users[0].UserFriendlyName, 'nodisplayuser');
  } finally {
    await envContext.cleanup();
  }
});

test('searchUsersForMentions returns results in Collabora format', async () => {
  const envContext = await setupTestEnv({
    tag: 'userSearch-format-',
    modules: ['src/services/userSearchService', 'src/services/users', 'src/services/db'],
  });
  const { searchUsersForMentions } = envContext.requireFresh('src/services/userSearchService');
  const users = envContext.requireFresh('src/services/users');

  try {
    const created = await users.createLocalUser({
      email: 'format@example.com',
      password: 'password123',
      username: 'formatuser',
      displayName: 'Format Test User',
      roles: ['user'],
    });

    const result = await searchUsersForMentions('format', 10);

    assert.equal(result.Users.length, 1);
    assert.ok(result.Users[0].UserId, 'Should have UserId');
    assert.ok(result.Users[0].UserFriendlyName, 'Should have UserFriendlyName');
    assert.ok(result.Users[0].UserEmail, 'Should have UserEmail');
    
    // Verify exact format expected by Collabora
    assert.equal(result.Users[0].UserId, created.id);
    assert.equal(result.Users[0].UserFriendlyName, 'Format Test User');
    assert.equal(result.Users[0].UserEmail, 'format@example.com');
  } finally {
    await envContext.cleanup();
  }
});

test('searchLocalUsers returns empty array for invalid input', async () => {
  const envContext = await setupTestEnv({
    tag: 'userSearch-local-',
    modules: ['src/services/userSearchService', 'src/services/db'],
  });
  const { searchLocalUsers } = envContext.requireFresh('src/services/userSearchService');

  try {
    assert.deepEqual(await searchLocalUsers(''), []);
    assert.deepEqual(await searchLocalUsers(null), []);
    assert.deepEqual(await searchLocalUsers(undefined), []);
    assert.deepEqual(await searchLocalUsers('   '), []);
  } finally {
    await envContext.cleanup();
  }
});

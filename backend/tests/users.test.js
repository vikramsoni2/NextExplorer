import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';

// Set up temp cache dir per test run
const tmp = fs.mkdtempSync(path.join(process.cwd(), 'tmp-test-users-'));
process.env.CACHE_DIR = tmp;

const users = await import('../services/users.js');

test('create and verify local user, change password, and lockout', async (t) => {
  // Initially no local users
  assert.equal(await users.countLocalUsers(), 0);

  // Create admin
  const admin = await users.createLocal({ username: 'Admin', password: 'secret123', roles: ['admin'] });
  assert.equal(admin.username, 'admin');
  assert.equal((await users.countLocalUsers()), 1);

  // Verify login
  let u = await users.verifyLocalCredentials({ username: 'admin', password: 'secret123' });
  assert.ok(u && u.id);

  // Wrong password attempts trigger lockout
  for (let i = 0; i < 5; i++) {
    const bad = await users.attemptLocalLogin({ username: 'admin', password: 'nope' });
    assert.equal(bad, null);
  }

  // Next attempt should throw 423 lockout
  await assert.rejects(() => users.attemptLocalLogin({ username: 'admin', password: 'nope' }), (err) => err.status === 423);

  // Change password (works with current)
  await users.changeLocalPassword({ userId: admin.id, currentPassword: 'secret123', newPassword: 'newpass456' });
  const ok = await users.verifyLocalCredentials({ username: 'admin', password: 'newpass456' });
  assert.ok(ok);
});


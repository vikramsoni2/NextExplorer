const test = require('node:test');
const assert = require('node:assert/strict');

const lockService = require('../../src/services/wopiLockService');

test('wopiLockService supports lock/unlock flow', () => {
  lockService.resetAllLocks();

  const fileId = 'file-1';
  const now = Date.now();

  assert.equal(lockService.getLock(fileId, now), null);

  assert.deepEqual(lockService.tryLock(fileId, 'lock-a', now), { ok: true });
  assert.equal(lockService.getLock(fileId, now + 1), 'lock-a');

  assert.deepEqual(lockService.tryLock(fileId, 'lock-b', now + 2), {
    ok: false,
    currentLockId: 'lock-a',
  });

  assert.deepEqual(lockService.tryUnlock(fileId, 'lock-b', now + 3), {
    ok: false,
    currentLockId: 'lock-a',
  });

  assert.deepEqual(lockService.tryUnlock(fileId, 'lock-a', now + 4), { ok: true });
  assert.equal(lockService.getLock(fileId, now + 5), null);
});

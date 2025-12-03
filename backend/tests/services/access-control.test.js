const test = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnv } = require('../helpers/env-test-utils');

const ACCESS_MODULES = [
  'src/services/storage/jsonStorage',
  'src/services/settingsService',
  'src/services/accessControlService',
];

const createAccessContext = async () => {
  const envContext = await setupTestEnv({
    tag: 'access-control-test-',
    modules: ACCESS_MODULES,
  });
  const accessControlService = envContext.requireFresh('src/services/accessControlService');
  return { envContext, accessControlService };
};

test('accessControlService honors rule order and recursion', async () => {
  const { envContext, accessControlService } = await createAccessContext();
  try {
    const stored = await accessControlService.setRules([
      { path: '/parent/child', permissions: 'hidden', recursive: false },
      { path: 'parent', permissions: 'ro', recursive: true },
    ]);

    assert.strictEqual(stored.length, 2);
    const rules = await accessControlService.getRules();
    assert.strictEqual(rules.length, 2);
    assert.strictEqual(rules[0].path, 'parent/child');

    assert.strictEqual(await accessControlService.getPermissionForPath('parent/child'), 'hidden');
    assert.strictEqual(await accessControlService.getPermissionForPath('parent/child/file.txt'), 'ro');
    assert.strictEqual(await accessControlService.getPermissionForPath('parent/other'), 'ro');
    assert.strictEqual(await accessControlService.getPermissionForPath('unmatched/path'), 'rw');
  } finally {
    await envContext.cleanup();
  }
});

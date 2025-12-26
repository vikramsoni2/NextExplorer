const test = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnv } = require('../helpers/env-test-utils');

const SETTINGS_MODULES = [
  'src/services/storage/jsonStorage',
  'src/services/settingsService',
];

const createSettingsContext = async () => {
  const envContext = await setupTestEnv({
    tag: 'settings-test-',
    modules: SETTINGS_MODULES,
  });
  const settingsService = envContext.requireFresh(
    'src/services/settingsService',
  );
  return { envContext, settingsService };
};

test('settingsService returns defaults when no config exists', async () => {
  const { envContext, settingsService } = await createSettingsContext();
  try {
    const settings = await settingsService.getSettings();
    assert.deepEqual(settings.access.rules, []);
    assert.strictEqual(settings.thumbnails.enabled, true);
    assert.strictEqual(settings.thumbnails.size, 200);
    assert.strictEqual(settings.thumbnails.quality, 70);
    assert.strictEqual(settings.thumbnails.concurrency, undefined);
  } finally {
    await envContext.cleanup();
  }
});

test('setSettings sanitizes thumbnails and filters access rules', async () => {
  const { envContext, settingsService } = await createSettingsContext();
  try {
    const payload = {
      thumbnails: { size: 5000, quality: 150, concurrency: -2 },
      access: {
        rules: [
          { path: '/Projects', permissions: 'ro', recursive: true },
          { path: 'uploads', permissions: 'invalid', recursive: false },
          { path: '../bad', permissions: 'hidden' },
        ],
      },
    };

    const updated = await settingsService.setSettings(payload);
    assert.strictEqual(updated.thumbnails.size, 1024);
    assert.strictEqual(updated.thumbnails.quality, 100);
    assert.strictEqual(updated.thumbnails.concurrency, 1);
    assert.strictEqual(updated.thumbnails.enabled, true);
    assert.strictEqual(updated.access.rules.length, 2);
    assert.strictEqual(updated.access.rules[0].path, 'Projects');
    assert.strictEqual(updated.access.rules[1].permissions, 'rw');
  } finally {
    await envContext.cleanup();
  }
});

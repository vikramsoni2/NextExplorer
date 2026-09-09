import { describe, it, expect } from 'vitest';
import { setupTestEnv } from '../helpers/env-test-utils.js';

const SETTINGS_MODULES = [
  'src/services/storage/jsonStorage',
  'src/services/settingsService',
  'src/services/db',
];

const createSettingsContext = async () => {
  const envContext = await setupTestEnv({
    tag: 'settings-test-',
    modules: SETTINGS_MODULES,
  });
  const settingsService = envContext.requireFresh('src/services/settingsService');
  const dbService = envContext.requireFresh('src/services/db');
  return { envContext, settingsService, dbService };
};

describe('Settings Service', () => {
  describe('getSettings', () => {
    it('should return defaults when no config exists', async () => {
      const { envContext, settingsService } = await createSettingsContext();
      try {
        const settings = await settingsService.getSettings();

        expect(settings.access.rules).toEqual([]);
        expect(settings.thumbnails.enabled).toBe(true);
        expect(settings.thumbnails.size).toBe(200);
        expect(settings.thumbnails.quality).toBe(70);
        expect(settings.thumbnails.concurrency).toBe(10);
      } finally {
        await envContext.cleanup();
      }
    });
  });

  describe('setSettings', () => {
    it('should sanitize thumbnails and filter access rules', async () => {
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

        expect(updated.thumbnails.size).toBe(1024);
        expect(updated.thumbnails.quality).toBe(100);
        expect(updated.thumbnails.concurrency).toBe(1);
        expect(updated.thumbnails.enabled).toBe(true);
        expect(updated.access.rules.length).toBe(2);
        expect(updated.access.rules[0].path).toBe('Projects');
        expect(updated.access.rules[1].permissions).toBe('rw');
      } finally {
        await envContext.cleanup();
      }
    });
  });

  describe('user sidebar settings', () => {
    it('should persist sidebar visibility preferences as booleans', async () => {
      const { envContext, settingsService, dbService } = await createSettingsContext();
      try {
        const db = await dbService.getDb();
        const now = new Date().toISOString();
        db.prepare(
          `
          INSERT INTO users (id, email, email_verified, username, display_name, roles, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
        ).run('user-1', 'user-1@example.com', 1, 'user-1', 'User 1', '["user"]', now, now);

        await settingsService.setUserSetting('user-1', 'showSidebarFavorites', false);
        await settingsService.setUserSetting('user-1', 'showSidebarShares', 0);
        await settingsService.setUserSetting('user-1', 'showSidebarTools', 'yes');

        const settings = await settingsService.getUserSettings('user-1');

        expect(settings.showSidebarFavorites).toBe(false);
        expect(settings.showSidebarShares).toBe(false);
        expect(settings.showSidebarTools).toBe(true);
      } finally {
        await envContext.cleanup();
      }
    });
  });

  describe('folder sorts', () => {
    it('merges custom folder sorts and caps the most recently used folders', async () => {
      const { envContext, settingsService, dbService } = await createSettingsContext();
      try {
        const db = await dbService.getDb();
        const now = new Date().toISOString();
        db.prepare(
          `
          INSERT INTO users (id, email, email_verified, username, display_name, roles, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
        ).run('user-1', 'user-1@example.com', 1, 'user-1', 'User 1', '["user"]', now, now);

        const folderSorts = Object.fromEntries(
          Array.from({ length: 101 }, (_, index) => [
            `Projects/folder-${index}`,
            { by: 'customColumn', order: 'desc', updatedAt: index },
          ])
        );

        await settingsService.setUserSetting('user-1', 'folderSorts', folderSorts);
        await settingsService.setUserFolderSort('user-1', 'Projects/new-folder', {
          by: 'owner',
          order: 'asc',
        });
        const settings = await settingsService.getUserSettings('user-1');

        expect(Object.keys(settings.folderSorts)).toHaveLength(100);
        expect(settings.folderSorts['Projects/folder-0']).toBeUndefined();
        expect(settings.folderSorts['Projects/folder-1']).toBeUndefined();
        expect(settings.folderSorts['Projects/folder-100']).toMatchObject({
          by: 'customColumn',
          order: 'desc',
        });
        expect(settings.folderSorts['Projects/new-folder']).toMatchObject({
          by: 'owner',
          order: 'asc',
        });
      } finally {
        await envContext.cleanup();
      }
    });
  });
});

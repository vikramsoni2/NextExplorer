import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSettings } from './appSettings';
import { useAuthStore } from './auth';
import { useSettingsStore } from './settings';

describe('settings store folder sorting', () => {
  let persistedFolderSorts;

  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    persistedFolderSorts = {};
    useAuthStore().currentUser = { id: 'user-1' };
  });

  const createSettingsStore = () => {
    const appSettings = useAppSettings();
    appSettings.loaded = true;
    appSettings.userSettings = {
      ...appSettings.userSettings,
      folderSorts: persistedFolderSorts,
    };
    vi.spyOn(appSettings, 'save').mockImplementation(async ({ user }) => {
      if (user.folderSort) {
        persistedFolderSorts = {
          ...persistedFolderSorts,
          [user.folderSort.path]: {
            ...user.folderSort.sort,
            updatedAt: Date.now(),
          },
        };
      }
      appSettings.userSettings = {
        ...appSettings.userSettings,
        folderSorts: persistedFolderSorts,
      };
      return appSettings.state;
    });

    return useSettingsStore();
  };

  it('restores each folder sort independently', async () => {
    const settings = createSettingsStore();

    settings.restoreSortForFolder('Projects/reports');
    await settings.setSort('dateModified', 'desc');

    settings.restoreSortForFolder('Projects/archive');
    expect(settings.sortBy).toMatchObject({ by: 'name', order: 'asc' });

    await settings.setSort('size', 'desc');
    settings.restoreSortForFolder('Projects/reports');
    expect(settings.sortBy).toMatchObject({ by: 'dateModified', order: 'desc' });

    settings.restoreSortForFolder('Projects/archive');
    expect(settings.sortBy).toMatchObject({ by: 'size', order: 'desc' });
  });

  it('persists folder sorts through user settings instead of local storage', async () => {
    localStorage.setItem(
      'settings:folderSorts',
      JSON.stringify({
        'Projects/reports': { by: 'size', order: 'asc' },
      })
    );
    const settings = createSettingsStore();

    settings.restoreSortForFolder('Projects/reports');
    expect(settings.sortBy).toMatchObject({ by: 'name', order: 'asc' });

    await settings.setSort('dateModified', 'desc');
    await nextTick();

    setActivePinia(createPinia());
    const reloadedSettings = createSettingsStore();
    reloadedSettings.restoreSortForFolder('Projects/reports');

    expect(reloadedSettings.sortBy).toMatchObject({ by: 'dateModified', order: 'desc' });
  });

  it('rebuilds custom sort options from persisted folder settings', async () => {
    persistedFolderSorts = {
      'Projects/reports': { by: 'owner', order: 'asc', updatedAt: Date.now() },
    };
    const settings = createSettingsStore();
    await nextTick();

    settings.restoreSortForFolder('Projects/reports');

    expect(settings.sortBy).toMatchObject({ by: 'owner', order: 'asc' });
    expect(settings.sortOptions).toContainEqual(
      expect.objectContaining({ by: 'owner', order: 'asc' })
    );
  });

  it('saves one folder sort without replacing existing folder settings', async () => {
    persistedFolderSorts = {
      'Projects/folder-a': { by: 'name', order: 'asc', updatedAt: 1 },
      'Projects/folder-b': { by: 'size', order: 'desc', updatedAt: 2 },
    };
    const settings = createSettingsStore();
    const appSettings = useAppSettings();

    settings.restoreSortForFolder('Projects/folder-c');
    await settings.setSort('owner', 'desc');

    expect(appSettings.save).toHaveBeenCalledWith({
      user: {
        folderSort: {
          path: 'Projects/folder-c',
          sort: { by: 'owner', order: 'desc' },
        },
      },
    });
    expect(persistedFolderSorts).toMatchObject({
      'Projects/folder-a': { by: 'name', order: 'asc' },
      'Projects/folder-b': { by: 'size', order: 'desc' },
      'Projects/folder-c': {
        by: 'owner',
        order: 'desc',
      },
    });
  });

  it('removes custom sort options when the authenticated user changes', async () => {
    const settings = createSettingsStore();

    settings.restoreSortForFolder('Projects/reports');
    await settings.setSort('owner', 'desc');
    useAuthStore().currentUser = { id: 'user-2' };

    expect(settings.sortOptions).not.toContainEqual(
      expect.objectContaining({ by: 'owner', order: 'desc' })
    );
    expect(settings.sortBy).toMatchObject({ by: 'name', order: 'asc' });
  });

  it('does not save a queued sort after the authenticated user changes', async () => {
    const settings = createSettingsStore();
    const appSettings = useAppSettings();

    settings.restoreSortForFolder('Projects/reports');
    const save = settings.setSort('dateModified', 'desc');
    useAuthStore().currentUser = { id: 'user-2' };
    await save;

    expect(appSettings.save).not.toHaveBeenCalled();
    expect(settings.sortBy).toMatchObject({ by: 'name', order: 'asc' });
  });
});

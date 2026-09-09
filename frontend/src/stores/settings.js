import { ref, computed, reactive, watch } from 'vue';
import { defineStore } from 'pinia';
import { useColorMode, useStorage } from '@vueuse/core';
import { useAuthStore } from '@/stores/auth';
import { useAppSettings } from '@/stores/appSettings';

const DEFAULT_SORT_OPTIONS = [
  { key: 1, name: 'Name A to Z', by: 'name', order: 'asc' },
  { key: 2, name: 'Name Z to A', by: 'name', order: 'desc' },
  { key: 3, name: 'Small to large', by: 'size', order: 'asc' },
  { key: 4, name: 'Large to small', by: 'size', order: 'desc' },
  { key: 7, name: 'Kind A to Z', by: 'kind', order: 'asc' },
  { key: 8, name: 'Kind Z to A', by: 'kind', order: 'desc' },
  { key: 5, name: 'Old to new', by: 'dateModified', order: 'asc' },
  { key: 6, name: 'New to old', by: 'dateModified', order: 'desc' },
];

export const useSettingsStore = defineStore('settings', () => {
  const appSettings = useAppSettings();
  const authStore = useAuthStore();

  const view = useStorage('settings:view', 'grid');
  const gridView = () => {
    view.value = 'grid';
  };
  const listView = () => {
    view.value = 'list';
  };
  const tabView = () => {
    view.value = 'tab';
  };
  const photosView = () => {
    view.value = 'photos';
  };

  // Photos mode item size (in px)
  const photoSize = useStorage('settings:photos:size', 160);

  // Office editor preference when multiple office integrations are enabled.
  // Values: 'onlyoffice' | 'collabora'
  const officeEditorPreference = useStorage('settings:officeEditor', 'onlyoffice');

  const terminalHeight = ref(10);

  const themeMode = useColorMode({
    selector: 'html',
    attribute: 'class',
    storageKey: 'settings:theme',
    initialValue: 'auto', // 'auto' | 'light' | 'dark'
    emitAuto: true,
    modes: { dark: 'dark', light: '' }, // only toggle .dark
  });

  const isDark = computed(() => themeMode.state.value === 'dark');

  const cycleTheme = () => {
    themeMode.value =
      themeMode.value === 'auto' ? 'light' : themeMode.value === 'light' ? 'dark' : 'auto';
  };

  const sortOptions = reactive(DEFAULT_SORT_OPTIONS.map((option) => ({ ...option })));

  const sortBy = ref(sortOptions[0]);
  const MAX_FOLDER_SORTS = 100;
  const MAX_FOLDER_PATH_LENGTH = 1024;
  const MAX_SORT_FIELD_LENGTH = 128;
  const folderSorts = ref({});
  const activeFolderPath = ref('');
  let hasLocalFolderSortChanges = false;
  let folderSortSaveChain = Promise.resolve();

  const getSortOption = (by, order) => sortOptions.find((o) => o.by === by && o.order === order);

  const isValidSort = (sort) =>
    sort &&
    typeof sort === 'object' &&
    typeof sort.by === 'string' &&
    sort.by.trim().length > 0 &&
    sort.by.length <= MAX_SORT_FIELD_LENGTH &&
    (sort.order === 'asc' || sort.order === 'desc');

  const normalizeFolderSorts = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([path, sort]) =>
            typeof path === 'string' &&
            path.length > 0 &&
            path.length <= MAX_FOLDER_PATH_LENGTH &&
            isValidSort(sort)
        )
        .map(([path, sort]) => [
          path,
          {
            by: sort.by.trim(),
            order: sort.order,
            updatedAt: Number.isFinite(sort.updatedAt) ? Math.floor(sort.updatedAt) : 0,
          },
        ])
        .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_FOLDER_SORTS)
    );
  };

  watch(
    () => appSettings.userSettings?.folderSorts,
    (value) => {
      const savedFolderSorts = normalizeFolderSorts(value);
      if (!hasLocalFolderSortChanges) {
        folderSorts.value = savedFolderSorts;
      } else {
        folderSorts.value = normalizeFolderSorts({
          ...savedFolderSorts,
          ...folderSorts.value,
        });
      }
    },
    { immediate: true }
  );

  watch(
    () => authStore.currentUser?.id ?? null,
    () => {
      hasLocalFolderSortChanges = false;
      folderSorts.value = normalizeFolderSorts(appSettings.userSettings?.folderSorts);
      activeFolderPath.value = '';
      sortOptions.splice(
        0,
        sortOptions.length,
        ...DEFAULT_SORT_OPTIONS.map((option) => ({ ...option }))
      );
      sortBy.value = sortOptions[0];
    },
    { flush: 'sync' }
  );

  const getOrCreateSortOption = (by, order) => {
    const existing = getSortOption(by, order);
    if (existing) {
      return existing;
    }

    if (!isValidSort({ by, order })) {
      return null;
    }

    const nextKey = Math.max(0, ...sortOptions.map((o) => Number(o.key) || 0)) + 1;
    const created = { key: nextKey, name: `${by} ${order}`, by, order };
    sortOptions.push(created);
    return created;
  };

  const saveSortForActiveFolder = (sort) => {
    const userId = authStore.currentUser?.id ?? null;
    const folderPath = activeFolderPath.value;
    if (!folderPath || !appSettings.loaded || !userId) return;

    const nextFolderSorts = normalizeFolderSorts({
      ...folderSorts.value,
      [folderPath]: {
        by: sort.by,
        order: sort.order,
        updatedAt: Date.now(),
      },
    });
    folderSorts.value = nextFolderSorts;
    hasLocalFolderSortChanges = true;

    const save = () => {
      if (authStore.currentUser?.id !== userId) return;
      return appSettings.save({
        user: {
          folderSort: {
            path: folderPath,
            sort: {
              by: sort.by,
              order: sort.order,
            },
          },
        },
      });
    };
    const result = folderSortSaveChain.then(save, save);
    folderSortSaveChain = result.catch(() => undefined);
    return result;
  };

  const applySort = (sort) => {
    if (!sort) return;
    sortBy.value = sort;
    return saveSortForActiveFolder(sort);
  };

  const setSortBy = (key) => {
    applySort(sortOptions.find((o) => o.key === key));
  };

  const setSort = (by, order) => {
    const sort = getOrCreateSortOption(by, order);
    if (!sort) return;
    return applySort(sort);
  };

  const restoreSortForFolder = (path) => {
    activeFolderPath.value = typeof path === 'string' ? path : '';
    const saved = folderSorts.value?.[activeFolderPath.value];
    sortBy.value = getOrCreateSortOption(saved?.by, saved?.order) || sortOptions[0];
  };

  const DEFAULT_LIST_VIEW_COLUMN_WIDTHS = [30, 420, 120, 160, 220];
  const LIST_VIEW_MIN_WIDTHS = [30, 200, 100, 120, 160];

  const listViewColumnWidths = useStorage(
    'settings:listView:columns',
    DEFAULT_LIST_VIEW_COLUMN_WIDTHS
  );

  const coerceListViewColumnWidths = (value) => {
    const existing = Array.isArray(value) ? value : [];
    return DEFAULT_LIST_VIEW_COLUMN_WIDTHS.map((defaultWidth, index) => {
      const proposed = Number(existing[index] ?? defaultWidth);
      const minWidth = LIST_VIEW_MIN_WIDTHS[index] ?? 30;
      return Number.isFinite(proposed) ? Math.max(minWidth, proposed) : defaultWidth;
    });
  };

  const ensureListViewColumnWidths = () => {
    const next = coerceListViewColumnWidths(listViewColumnWidths.value);
    const current = Array.isArray(listViewColumnWidths.value) ? listViewColumnWidths.value : [];
    const same = next.length === current.length && next.every((w, i) => w === current[i]);
    if (!same) {
      listViewColumnWidths.value = next;
    }
  };

  ensureListViewColumnWidths();

  const listViewGridTemplateColumns = computed(() => {
    const next = coerceListViewColumnWidths(listViewColumnWidths.value);
    return next.map((w) => `${w}px`).join(' ');
  });

  const setListViewColumnWidth = (index, widthPx) => {
    if (!Number.isFinite(index)) return;
    if (!Number.isFinite(widthPx)) return;

    ensureListViewColumnWidths();

    const minWidth = LIST_VIEW_MIN_WIDTHS[index] ?? 30;
    const next = [...listViewColumnWidths.value];
    next[index] = Math.max(minWidth, Math.round(widthPx));
    listViewColumnWidths.value = next;
  };

  const resetListViewColumnWidths = () => {
    listViewColumnWidths.value = [...DEFAULT_LIST_VIEW_COLUMN_WIDTHS];
  };

  return {
    view,
    gridView,
    listView,
    tabView,
    photosView,
    photoSize,
    officeEditorPreference,
    themeMode,
    isDark,
    cycleTheme,
    sortBy,
    setSortBy,
    setSort,
    restoreSortForFolder,
    sortOptions,
    terminalHeight,
    listViewColumnWidths,
    listViewGridTemplateColumns,
    setListViewColumnWidth,
    resetListViewColumnWidths,
  };
});

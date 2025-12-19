import { ref, computed, reactive } from 'vue'
import { defineStore } from 'pinia'
import { useColorMode, useStorage } from '@vueuse/core';

export const useSettingsStore = defineStore('settings', () => {
  
  const view = useStorage('settings:view', 'grid')
  const gridView=()=>{view.value = 'grid'}
  const listView=()=>{view.value = 'list'}
  const tabView=()=>{view.value = 'tab'}
  const photosView=()=>{view.value = 'photos'}

  // Photos mode item size (in px)
  const photoSize = useStorage('settings:photos:size', 160)

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


  const sortOptions = reactive([
    {key:1, name: 'Name A to Z', by: 'name', order: 'asc'},
    {key:2, name: 'Name Z to A', by: 'name', order: 'desc'},
    {key:3, name: 'Small to large', by: 'size', order: 'asc'},
    {key:4, name: 'Large to small', by: 'size', order: 'desc'},
    {key:7, name: 'Kind A to Z', by: 'kind', order: 'asc'},
    {key:8, name: 'Kind Z to A', by: 'kind', order: 'desc'},
    {key:5, name: 'Old to new', by: 'dateModified', order:'asc'},
    {key:6, name: 'New to old', by: 'dateModified', order:'desc'}
  ])

  const sortBy = ref(sortOptions[0]);

  const setSortBy = (key) => {
    sortBy.value = sortOptions.find(o => o.key === key);
  }

  const setSort = (by, order) => {
    if (!by || !order) return;
    const existing = sortOptions.find((o) => o.by === by && o.order === order);
    if (existing) {
      sortBy.value = existing;
      return;
    }

    const nextKey = Math.max(0, ...sortOptions.map((o) => Number(o.key) || 0)) + 1;
    const created = { key: nextKey, name: `${by} ${order}`, by, order };
    sortOptions.push(created);
    sortBy.value = created;
  };

  const DEFAULT_LIST_VIEW_COLUMN_WIDTHS = [30, 420, 120, 160, 220];
  const LIST_VIEW_MIN_WIDTHS = [30, 200, 100, 120, 160];

  const listViewColumnWidths = useStorage(
    'settings:listView:columns',
    DEFAULT_LIST_VIEW_COLUMN_WIDTHS,
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
    themeMode,
    isDark,
    cycleTheme,
    sortBy,
    setSortBy,
    setSort,
    sortOptions,
    terminalHeight,
    listViewColumnWidths,
    listViewGridTemplateColumns,
    setListViewColumnWidth,
    resetListViewColumnWidths,
  }
})

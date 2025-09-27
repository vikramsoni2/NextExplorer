import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { browse, copyItems, moveItems, deleteItems, normalizePath } from '@/api';
import { useSettingsStore } from '@/stores/settings';

export const useFileStore = defineStore('fileStore', () => {
  // State
  const currentPath = ref('');
  const currentPathItems = ref([]);
  const selectedItems = ref([]);

  const copiedItems = ref([]);
  const cutItems = ref([]);

  const hasSelection = computed(() => selectedItems.value.length > 0);
  const hasClipboardItems = computed(() => copiedItems.value.length > 0 || cutItems.value.length > 0);

  const serializeItems = (items) => items
    .filter((item) => item && item.name && item.kind !== 'volume')
    .map((item) => ({
      name: item.name,
      path: normalizePath(item.path || ''),
      kind: item.kind,
    }));

  const resetClipboard = () => {
    copiedItems.value = [];
    cutItems.value = [];
  };

  const copy = () => {
    if (!hasSelection.value) return;
    cutItems.value = [];
    copiedItems.value = selectedItems.value.map((item) => ({ ...item }));
  };

  const cut = () => {
    if (!hasSelection.value) return;
    copiedItems.value = [];
    cutItems.value = selectedItems.value.map((item) => ({ ...item }));
  };

  const paste = async () => {
    const destination = normalizePath(currentPath.value || '');

    if (copiedItems.value.length > 0) {
      const payload = serializeItems(copiedItems.value);
      if (payload.length > 0) {
        await copyItems(payload, destination);
      }
      copiedItems.value = [];
    }

    if (cutItems.value.length > 0) {
      const payload = serializeItems(cutItems.value);
      if (payload.length > 0) {
        await moveItems(payload, destination);
      }
      cutItems.value = [];
    }

    await fetchPathItems(destination);
  };

  const del = async () => {
    const payload = serializeItems(selectedItems.value);
    if (payload.length === 0) return;

    await deleteItems(payload);
    selectedItems.value = [];
    await fetchPathItems(currentPath.value);
  };
  
  // Getters
  const getCurrentPath = computed(() => currentPath.value);

  // get sorted currentPathItems
  const getCurrentPathItems = computed(() => {
    const settings = useSettingsStore();
    const direction = settings.sortBy.order === 'asc' ? 1 : -1;

    return [...currentPathItems.value].sort((a, b) => {
      if (a.kind === 'directory' && b.kind != 'directory') return -1;
      if (a.kind != 'directory' && b.kind === 'directory') return 1;
      const aValue = a[settings.sortBy.by];
      const bValue = b[settings.sortBy.by];
      if (aValue === bValue) return 0;
      return aValue > bValue ? direction : -direction;
    });
  });

  // Actions
  function setCurrentPath(path) {
    currentPath.value = normalizePath(path);
  }

  async function fetchPathItems(path) {
    const normalizedPath = normalizePath(typeof path === 'string' ? path : currentPath.value);
    currentPath.value = normalizedPath;
    selectedItems.value = [];
    currentPathItems.value = await browse(normalizedPath);
    return currentPathItems.value;
  }

  return {
    currentPath,
    getCurrentPath,
    setCurrentPath,
    currentPathItems,
    getCurrentPathItems,
    fetchPathItems,
    selectedItems,
    copiedItems,
    cutItems,
    hasSelection,
    hasClipboardItems,
    copy, 
    cut,
    paste,
    del,
    resetClipboard,
  };
});

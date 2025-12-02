import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  browse,
  copyItems,
  moveItems,
  deleteItems,
  normalizePath,
  createFolder as createFolderApi,
  renameItem as renameItemApi,
  saveFileContent as saveFileContentApi,
  fetchThumbnail as fetchThumbnailApi,
  browseShare,
} from '@/api';
import { useSettingsStore } from '@/stores/settings';
import { useAppSettings } from '@/stores/appSettings';

export const useFileStore = defineStore('fileStore', () => {
  // State
  const currentPath = ref('');
  const currentPathItems = ref([]);
  const currentPathData = ref(null);
  const selectedItems = ref([]);
  const renameState = ref(null);

  const copiedItems = ref([]);
  const cutItems = ref([]);
  const thumbnailRequests = new Map();

  const hasSelection = computed(() => selectedItems.value.length > 0);
  const hasClipboardItems = computed(() => copiedItems.value.length > 0 || cutItems.value.length > 0);

  const itemKey = (item) => {
    if (!item || !item.name) {
      return '';
    }

    const parent = normalizePath(item.path || '');
    return `${parent}::${item.name}`;
  };

  const findItemByKey = (key) => currentPathItems.value.find((item) => itemKey(item) === key);

  const resolveItemRelativePath = (item) => {
    if (!item || !item.name) {
      return null;
    }

    const parent = normalizePath(item.path || '');
    const combined = parent ? `${parent}/${item.name}` : item.name;
    return normalizePath(combined);
  };

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

  const paste = async (targetPath) => {
    const hasTarget = typeof targetPath === 'string' && targetPath.trim().length > 0;
    const destination = normalizePath(hasTarget ? targetPath : currentPath.value || '');
    const refreshTarget = normalizePath(currentPath.value || '');

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

    await fetchPathItems(refreshTarget);
  };

  const del = async () => {
    const payload = serializeItems(selectedItems.value);
    if (payload.length === 0) return;

    await deleteItems(payload);
    selectedItems.value = [];
    await fetchPathItems(currentPath.value);
  };

  const createFolder = async (baseName) => {
    const destination = normalizePath(currentPath.value || '');
    const response = await createFolderApi(destination, baseName);
    const createdName = response?.item?.name;

    await fetchPathItems(destination);

    if (createdName) {
      const createdKey = `${destination}::${createdName}`;
      const createdItem = findItemByKey(createdKey);
      if (createdItem) {
        selectedItems.value = [createdItem];
        beginRename(createdItem, { isNew: true });
      }
    }

    return response;
  };

  const createFile = async (baseName) => {
    const destination = normalizePath(currentPath.value || '');

    // Determine a default base name and extension
    const defaultName = (typeof baseName === 'string' && baseName.trim())
      ? baseName.trim()
      : 'Untitled.txt';

    // Split name into stem + extension (preserve provided extension if present)
    const lastDot = defaultName.lastIndexOf('.');
    const stem = lastDot > 0 ? defaultName.slice(0, lastDot) : defaultName;
    const ext = lastDot > 0 ? defaultName.slice(lastDot) : '';

    // Ensure the name is unique in current listing
    const existingNames = new Set((currentPathItems.value || []).map((it) => it?.name).filter(Boolean));
    let candidate = `${stem}${ext}`;
    let counter = 2;
    while (existingNames.has(candidate)) {
      candidate = `${stem} ${counter}${ext}`;
      counter += 1;
    }

    const relativePath = destination ? `${destination}/${candidate}` : candidate;

    // Create empty file
    await saveFileContentApi(relativePath, '');

    // Refresh and start rename for the created item
    await fetchPathItems(destination);

    const createdKey = `${destination}::${candidate}`;
    const createdItem = findItemByKey(createdKey);
    if (createdItem) {
      selectedItems.value = [createdItem];
      beginRename(createdItem, { isNew: true });
    }

    return { success: true, name: candidate };
  };

  const beginRename = (item, options = {}) => {
    if (!item || !item.name) return;

    const key = itemKey(item);
    const existing = findItemByKey(key);
    const target = existing || { ...item };

    selectedItems.value = [target];

    renameState.value = {
      key,
      path: normalizePath(target.path || currentPath.value || ''),
      originalName: target.name,
      draft: target.name,
      kind: target.kind,
      isNew: Boolean(options.isNew),
    };
  };

  const setRenameDraft = (value) => {
    if (!renameState.value) return;
    renameState.value.draft = value;
  };

  const cancelRename = () => {
    renameState.value = null;
  };

  const applyRename = async () => {
    const state = renameState.value;
    if (!state) return;

    const newName = state.draft ?? '';
    if (!newName.trim()) {
      renameState.value = null;
      return;
    }

    if (newName === state.originalName) {
      renameState.value = null;
      return;
    }

    const targetPath = state.path;

    try {
      const response = await renameItemApi(targetPath, state.originalName, newName);
      const renamedName = response?.item?.name ?? newName;
      renameState.value = null;
      await fetchPathItems(targetPath);
      const renamedKey = `${targetPath}::${renamedName}`;
      const renamedItem = findItemByKey(renamedKey);
      if (renamedItem) {
        selectedItems.value = [renamedItem];
      }
    } catch (error) {
      throw error;
    }
  };

  const isItemBeingRenamed = (item) => {
    if (!renameState.value) return false;
    return itemKey(item) === renameState.value.key;
  };

  const ensureItemThumbnail = async (item) => {
    if (!item || !item.name) {
      return null;
    }

    const kind = (item.kind || '').toLowerCase();
    if (kind === 'directory' || kind === 'pdf') {
      return null;
    }

    // Check if item supports thumbnails (set by backend)
    if (!item.supportsThumbnail) {
      return null;
    }

    // Respect app settings: if thumbnails disabled or settings not yet loaded, skip
    try {
      const appSettings = useAppSettings();
      if (!appSettings.loaded) {
        if (!appSettings.loading) await appSettings.load();
      }
      if (appSettings.loaded && appSettings.state.thumbnails?.enabled === false) {
        return null;
      }
    } catch (e) {
      // If settings store fails, fail open to avoid breaking UI, but do not spam
    }

    const key = itemKey(item);
    if (!key) {
      return null;
    }

    const existing = findItemByKey(key);
    if (existing?.thumbnail) {
      return existing.thumbnail;
    }

    let pending = thumbnailRequests.get(key);
    if (!pending) {
      const relativePath = resolveItemRelativePath(item);
      if (!relativePath) {
        return null;
      }

      pending = (async () => {
        try {
          const response = await fetchThumbnailApi(relativePath);
          const thumbnail = response?.thumbnail || '';
          if (thumbnail) {
            const target = findItemByKey(key);
            if (target) {
              target.thumbnail = thumbnail;
            }
          }
          return thumbnail || null;
        } catch (error) {
          console.error(`Failed to fetch thumbnail for ${relativePath}`, error);
          return null;
        } finally {
          thumbnailRequests.delete(key);
        }
      })();

      thumbnailRequests.set(key, pending);
    }

    return pending;
  };
  
  const getCurrentPath = computed(() => currentPath.value);

  const getCurrentPathItems = computed(() => {
    const settings = useSettingsStore();
    const direction = settings.sortBy.order === 'asc' ? 1 : -1;

    return [...currentPathItems.value].sort((a, b) => {
      // keep directories first
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
    const previousItems = Array.isArray(currentPathItems.value)
      ? currentPathItems.value
      : [];

    const normalizedPath = normalizePath(typeof path === 'string' ? path : currentPath.value);
    currentPath.value = normalizedPath;
    selectedItems.value = [];

    let response;

    // For share paths, use the dedicated share browse endpoint so that
    // file shares can be treated as virtual one-item directories.
    if (normalizedPath && normalizedPath.startsWith('share/')) {
      const segments = normalizedPath.split('/');
      const shareToken = segments[1];
      const innerPath = segments.slice(2).join('/');
      response = await browseShare(shareToken, innerPath);
    } else {
      response = await browse(normalizedPath);
    }

    // Merge new items into existing list by stable key so that
    // unchanged entries keep their object identity (and any local
    // UI fields such as thumbnails), while still updating metadata
    // and adding/removing items as needed.
    const mergeItems = (items) => {
      if (!Array.isArray(items)) return [];

      const existingByKey = new Map(
        previousItems
          .filter((it) => it && it.name)
          .map((it) => [itemKey(it), it]),
      );

      const merged = [];

      for (const incoming of items) {
        if (!incoming || !incoming.name) continue;

        const key = itemKey(incoming);
        const existing = existingByKey.get(key);

        if (existing) {
          // Preserve any locally-added thumbnail if the backend
          // does not send one, but refresh all other metadata.
          const prevThumbnail = existing.thumbnail;
          Object.assign(existing, incoming);
          if (!incoming.thumbnail && prevThumbnail) {
            existing.thumbnail = prevThumbnail;
          }
          merged.push(existing);
        } else {
          merged.push(incoming);
        }
      }

      return merged;
    };

    // Handle new response format with items and access metadata
    if (response && typeof response === 'object' && Array.isArray(response.items)) {
      currentPathItems.value = mergeItems(response.items);
      currentPathData.value = {
        path: response.path || normalizedPath,
        canRead: response.access?.canRead ?? true,
        canWrite: response.access?.canWrite ?? false,
        canUpload: response.access?.canUpload ?? false,
        canDelete: response.access?.canDelete ?? false,
        canShare: response.access?.canShare ?? false,
        canDownload: response.access?.canDownload ?? true,
        // Include share metadata if present
        shareInfo: response.shareInfo || null,
      };
    } else {
      // Fallback for old response format (array of items)
      currentPathItems.value = mergeItems(Array.isArray(response) ? response : []);
      currentPathData.value = null;
    }

    return currentPathItems.value;
  }

  return {
    currentPath,
    getCurrentPath,
    setCurrentPath,
    currentPathItems,
    currentPathData,
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
    createFolder,
    createFile,
    renameState,
    beginRename,
    setRenameDraft,
    cancelRename,
    applyRename,
    isItemBeingRenamed,
    ensureItemThumbnail,
  };
});

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getPreviewUrl, normalizePath, downloadItems, fetchFileContent } from '@/api';
import router from '@/router';

/**
 * Simplified preview manager with clearer responsibilities
 */
export const usePreviewManager = defineStore('preview-manager', () => {
  // State
  const plugins = ref([]);
  const activeItem = ref(null);
  const activePlugin = ref(null);

  // Computed
  const isOpen = computed(() => !!activeItem.value);

  // Helper: Get file extension
  const getExtension = (item) => {
    if (!item) return '';
    const kind = String(item.kind || '').toLowerCase();
    if (kind && kind !== 'directory') return kind;
    
    const name = String(item.name || '');
    const lastDot = name.lastIndexOf('.');
    return lastDot > 0 ? name.slice(lastDot + 1).toLowerCase() : '';
  };

  // Helper: Build full path
  const getFullPath = (item) => {
    if (!item?.name) return '';
    const parent = normalizePath(item.path || '');
    return normalizePath(parent ? `${parent}/${item.name}` : item.name);
  };

  // Core API - simple and direct
  const createApi = (item) => ({
    // Direct file operations
    getPreviewUrl: () => getPreviewUrl(getFullPath(item)),
    fetchContent: () => fetchFileContent(getFullPath(item)),
    
    // Navigation
    openEditor: () => {
      const path = getFullPath(item);
      if (path) router.push({ path: `/editor/${path}` });
    },
    
    // Download
    download: async () => {
      const path = getFullPath(item);
      if (!path) return;
      
      const response = await downloadItems([path]);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = item.name || 'download';
      link.click();
      
      URL.revokeObjectURL(url);
    },
    
    // Close
    close: () => close(),
  });

  // Plugin Management
  const register = (plugin) => {
    if (!plugin?.id) return;
    
    // Remove existing plugin with same id
    plugins.value = plugins.value.filter(p => p.id !== plugin.id);
    
    // Add and sort by priority (descending)
    plugins.value.push(plugin);
    plugins.value.sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      return priorityB - priorityA || a.id.localeCompare(b.id);
    });
  };

  const unregister = (pluginId) => {
    plugins.value = plugins.value.filter(p => p.id !== pluginId);
  };

  // Find matching plugin
  const findPlugin = (item) => {
    if (!item) return null;
    
    const extension = getExtension(item);
    const fullPath = getFullPath(item);
    const previewUrl = getPreviewUrl(fullPath);
    const api = createApi(item);

    // Simple context object
    const context = {
      item: { ...item },
      extension,
      filePath: fullPath,
      previewUrl,
      api,
    };

    // Find first matching plugin
    for (const plugin of plugins.value) {
      try {
        if (plugin.match?.(context)) {
          return { plugin, context };
        }
      } catch (error) {
        console.error(`Plugin ${plugin.id} match error:`, error);
      }
    }

    return null;
  };

  // Open preview
  const open = (item) => {
    const match = findPlugin(item);
    if (!match) return false;

    const { plugin, context } = match;

    // Call lifecycle hook
    try {
      plugin.onOpen?.(context);
    } catch (error) {
      console.error(`Plugin ${plugin.id} onOpen error:`, error);
    }

    // Update state
    activeItem.value = context;
    activePlugin.value = plugin;

    return true;
  };

  // Close preview
  const close = () => {
    if (!activePlugin.value || !activeItem.value) return;

    // Call lifecycle hook
    try {
      activePlugin.value.onClose?.(activeItem.value);
    } catch (error) {
      console.error(`Plugin ${activePlugin.value.id} onClose error:`, error);
    }

    // Clear state
    activeItem.value = null;
    activePlugin.value = null;
  };

  return {
    // State
    plugins,
    isOpen,
    activeItem,
    activePlugin,
    
    // Actions
    register,
    unregister,
    open,
    close,
    findPlugin,
  };
});
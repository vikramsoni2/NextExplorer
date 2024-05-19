import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { browse } from '@/api';
import { useSettingsStore } from '@/stores/settings'

export const useNavStore = defineStore('navStore', () => {
  // State
  const currentPath = ref(null);
  const currentPathItems = ref([]);
  const selectedItems = ref([]);

  // Getters
  const getCurrentPath = computed(() => currentPath.value);

  // get sorted currentPathItems
  const getCurrentPathItems = computed(() => {
    const settings = useSettingsStore();
    return currentPathItems.value.sort((a, b) => {
      if (a.kind === 'directory' && b.kind != 'directory') return -1;
      if (a.kind != 'directory' && b.kind === 'directory') return 1;
      if (a[settings.sortBy.by] > b[settings.sortBy.by]) return settings.sortBy.order === 'asc' ? 1 : -1;
      if (a[settings.sortBy.by] < b[settings.sortBy.by]) return settings.sortBy.order === 'asc' ? -11 : 1;
      return 0;
    });
  });

  // Actions
  function setCurrentPath(path) {
    console.log('setCurrentPath', path);
    currentPath.value = path;
  }

  async function fetchPathItems(path) {
    if(path) currentPath.value = path;
    else currentPath.value = "/"; 
    selectedItems.value = [];
    currentPathItems.value = await browse(currentPath.value);
    return currentPathItems
  }

  return {
    currentPath,
    getCurrentPath,
    setCurrentPath,
    currentPathItems,
    getCurrentPathItems,
    fetchPathItems,
    selectedItems
  };
});

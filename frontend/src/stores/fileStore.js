import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { browse, copyItem, moveItem, deleteItem } from '@/api';
import { useSettingsStore } from '@/stores/settings'

export const useFileStore = defineStore('fileStore', () => {
  // State
  const currentPath = ref(null);
  const currentPathItems = ref([]);
  const selectedItems = ref([]);

  const copiedItems = ref([]);
  const cutItems = ref([]);

  const copy = () => {
    cutItems.value = []
    copiedItems.value = selectedItems.value;
  }
  const cut = () => {
    copyItems.value = []
    cutItems.value = selectedItems.value;
  }

  const paste = async () => {
    if(copiedItems.value.length > 0){
      copiedItems.value.forEach(async (item) => {
        await copyItem(item, currentPath.value);
      });
    }
    if(cutItems.value.length > 0){
      cutItems.value.forEach(async (item) => {
        await moveItem(item, currentPath.value);
      });
    }
  }

  const del = async () => {
    selectedItems.value.forEach(async (item) => {
      await deleteItem(item);
    });
  }
  
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
    selectedItems,
    copy, 
    cut,
    del
  };
});

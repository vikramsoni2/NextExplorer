import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useNavStore = defineStore('navStore', () => {
  // State
  const currentPath = ref(null);

  // Getters
  const getCurrentPath = computed(() => currentPath.value);

  // Actions
  function setCurrentPath(path) {
    console.log('setCurrentPath', path);
    currentPath.value = path;
  }

  return {
    currentPath,
    getCurrentPath,
    setCurrentPath,
  };
});

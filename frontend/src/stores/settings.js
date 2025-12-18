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
    {key:5, name: 'Old to new', by: 'dateModified', order:'asc'},
    {key:6, name: 'New to old', by: 'dateModified', order:'desc'}
  ])

  const sortBy = ref(sortOptions[0]);

  const setSortBy = (key) => {
    sortBy.value = sortOptions.find(o => o.key === key);
  }

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
    sortOptions,
    terminalHeight
  }
})

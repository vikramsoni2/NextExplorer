import { ref, computed, reactive } from 'vue'
import { defineStore } from 'pinia'
import { useDark, useMediaQuery, useStorage, useToggle } from '@vueuse/core';

export const useSettingsStore = defineStore('settings', () => {
  
  const view = ref('grid')
  const gridView=()=>{view.value = 'grid'}
  const listView=()=>{view.value = 'list'}
  const tabView=()=>{view.value = 'tab'}

  const terminalHeight = ref(10);
  
  const isDark = useDark({ disableTransition: false });
  const toggleDark = useToggle(isDark);


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
    isDark,
    toggleDark,
    sortBy,
    setSortBy,
    sortOptions,
    terminalHeight
  }
})

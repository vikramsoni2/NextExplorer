import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useDark, useMediaQuery, useStorage, useToggle } from '@vueuse/core';

export const useSettingsStore = defineStore('counter', () => {
  
  const view = ref('grid')
  const gridView=()=>{view.value = 'grid'}
  const listView=()=>{view.value = 'list'}
  const tabView=()=>{view.value = 'tab'}

  const isDark = useDark({ disableTransition: false });
  const toggleDark = useToggle(isDark);


  const sortOptions = [
    {key:1, name: 'Name A to Z', by: 'name', order: 'asc'},
    {key:2, name: 'Name Z to A', by: 'name', order: 'desc'},
    {key:3, name: 'Small to large', by: 'size', order: 'asc'},
    {key:4, name: 'Large to small', by: 'dateModified', order: 'desc'},
    {key:5, name: 'Old to new', by: 'dateModified', order:'asc'},
    {key:6, name: 'New to old', by: 'dateModified', order:'desc'}
  ]

  const sortBy = ref({key:1, name: 'Name ascending', by: 'name', order: 'asc'},);
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
    sortOptions
  }
})

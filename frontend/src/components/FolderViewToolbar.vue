<script setup>
import NavButtons from '@/components/NavButtons.vue';
import BreadCrumb from '@/components/BreadCrumb.vue';
import MenuItemInfo from '@/components/MenuItemInfo.vue';
import MenuSortBy from '@/components/MenuSortBy.vue';
import ViewMode from '@/components/ViewMode.vue';
import PhotoSizeControl from '@/components/PhotoSizeControl.vue';
import NotificationBell from '@/components/NotificationBell.vue';
import SearchBar from '@/components/SearchBar.vue';
import { useSettingsStore } from '@/stores/settings';

const settings = useSettingsStore();

// Helper component for toolbar divider
const ToolbarDivider = {
  template: '<div class="h-8 w-px mx-1 md:mx-3 bg-neutral-200 dark:bg-neutral-700"></div>'
};
</script>

<template>
  <div class="z-10  p-3">
    <div
    class="flex items-center shrink-0 sticky top-0"
    >
      <label for="sidebar-toggle" class="lg:hidden -ml-2 mr-3 p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 inline-flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6">
          <path fill-rule="evenodd" d="M3.75 5.25a.75.75 0 01.75-.75h15a.75.75 0 010 1.5H4.5a.75.75 0 01-.75-.75zm0 6a.75.75 0 01.75-.75h15a.75.75 0 010 1.5H4.5a.75.75 0 01-.75-.75zm0 6a.75.75 0 01.75-.75h15a.75.75 0 010 1.5H4.5a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
        </svg>
      </label>

      <NavButtons />
      <BreadCrumb class="ml-2"/>

      <MenuItemInfo class="ml-auto"/>
      <ToolbarDivider />
      <MenuSortBy />
      <ToolbarDivider />
      <ViewMode />
      <PhotoSizeControl v-if="settings.view === 'photos'" />
      <ToolbarDivider />
      <NotificationBell />
      <SearchBar />
    </div>
    
  </div>
 
</template>

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

</script>

<template>
  <div class="z-10  p-3">
    <div class="flex items-center shrink-0 sticky top-0">
      <NavButtons />
      <BreadCrumb class="ml-2"/>

      <MenuItemInfo class="ml-auto"/>
      <div class="h-8 w-px mx-1 md:mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
      <MenuSortBy />
      <div class="h-8 w-px mx-1 md:mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
      <ViewMode />
      <PhotoSizeControl v-if="settings.view === 'photos'" />
      <div class="max-md:hidden h-8 w-px mx-1 md:mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
      <NotificationBell class="max-md:hidden"/>
      <SearchBar class="max-md:hidden"/>
    </div>
    
  </div>
 
</template>

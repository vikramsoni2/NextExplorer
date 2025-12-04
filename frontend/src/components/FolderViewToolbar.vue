<script setup>
import { computed } from 'vue';
import NavButtons from '@/components/NavButtons.vue';
import BreadCrumb from '@/components/BreadCrumb.vue';
import MenuItemInfo from '@/components/MenuItemInfo.vue';
import MenuSortBy from '@/components/MenuSortBy.vue';
import ViewMode from '@/components/ViewMode.vue';
import PhotoSizeControl from '@/components/PhotoSizeControl.vue';
import NotificationBell from '@/components/NotificationBell.vue';
import SearchBar from '@/components/SearchBar.vue';
import MenuShare from '@/components/MenuShare.vue';
import CreateNew from '@/components/CreateNew.vue';
import { useSettingsStore } from '@/stores/settings';
import { useAuthStore } from '@/stores/auth';
import { useFileStore } from '@/stores/fileStore';
import { useRoute } from 'vue-router';

const settings = useSettingsStore();
const auth = useAuthStore();
const fileStore = useFileStore();
const route = useRoute();

// Check if we're at the volumes home view (no path selected)
const isVolumesView = computed(() => {
  const p = route.params.path;
  const s = Array.isArray(p) ? p.join('/') : (p || '');
  return !s || s.trim() === '';
});

// Check if user can upload/create (based on backend permissions)
const canCreate = computed(() => {
  // Always hide on volumes view
  if (isVolumesView.value) return false;

  // For authenticated users, show unless explicitly denied
  if (auth.isAuthenticated && !auth.isGuest) return true;

  // For guests, check if current path has upload permission
  // This allows guests on readwrite shares to upload
  const currentPathData = fileStore.currentPathData;
  return currentPathData?.canUpload === true;
});

</script>

<template>
  <div class="z-10 p-3">
    <div class="flex flex-wrap items-center shrink-0 sticky top-0">
      <CreateNew v-if="canCreate" class="mr-3  max-lg:ml-12"/>
      
      <div class="flex items-center max-sm:order-2 max-sm:basis-full max-sm:bg-black max-sm:p-1 max-sm:my-1 max-sm:rounded-xl">
        <NavButtons />
        <BreadCrumb class="ml-2"/>
      </div>
      
      <div class="flex items-center ml-auto">
        <MenuItemInfo class="ml-auto"/>
        <div class="h-8 w-px mx-1 md:mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
        <MenuShare />
        <div class="h-8 w-px mx-1 md:mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
        <MenuSortBy />
        <div class="h-8 w-px mx-1 md:mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
        <ViewMode />
        <PhotoSizeControl v-if="settings.view === 'photos'" />
        <div class="max-md:hidden h-8 w-px mx-1 md:mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
        <NotificationBell/>
        <SearchBar/>
      </div>
      
    </div>

  </div>

</template>

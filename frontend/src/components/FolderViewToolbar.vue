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
import { Bars3Icon } from '@heroicons/vue/24/outline';

const settings = useSettingsStore();
const auth = useAuthStore();
const fileStore = useFileStore();
const route = useRoute();

defineEmits(['toggle-sidebar']);

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
  <div
    class="sticky top-0 z-40 border-b border-neutral-200/90 bg-white/90 p-3 backdrop-blur
    dark:border-white/10 dark:bg-base/90"
  >
    <div class="flex flex-wrap items-center shrink-0">
      <button
        type="button"
        class="-ml-1 mr-1.5 rounded-md p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 lg:hidden"
        :aria-label="$t('browser.openSidebar')"
        @click="$emit('toggle-sidebar')"
      >
        <Bars3Icon class="h-6 w-6" />
      </button>

      <CreateNew v-if="canCreate" class="mr-3"/>
      
      <div class="flex items-center max-sm:order-2 max-sm:basis-full max-sm:bg-zinc-800 max-sm:p-1 max-sm:my-1 max-sm:rounded-xl">
        <NavButtons />
        <BreadCrumb class="ml-2"/>
      </div>
      
      <div class="flex items-center ml-auto">
        <template v-if="!isVolumesView">
          <MenuItemInfo class="ml-auto"/>
          <div class="h-8 w-px mx-1 md:mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
          <MenuShare />
          <div class="h-8 w-px mx-1 md:mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
          <MenuSortBy />
          <div class="h-8 w-px mx-1 md:mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
          <ViewMode />
          <PhotoSizeControl v-if="settings.view === 'photos'" />
          <div class="max-md:hidden h-8 w-px mx-1 md:mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
        </template>
        <NotificationBell/>
        <SearchBar/>
      </div>
      
    </div>

  </div>

</template>

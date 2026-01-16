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
import { useRoute, useRouter } from 'vue-router';
import { Bars3Icon, HomeIcon } from '@heroicons/vue/24/outline';
import { useInputMode } from '@/composables/useInputMode';

const settings = useSettingsStore();
const auth = useAuthStore();
const fileStore = useFileStore();
const route = useRoute();
const router = useRouter();
const { isTouchDevice } = useInputMode();

defineEmits(['toggle-sidebar']);

// Check if we're at the volumes home view (no path selected)
const isVolumesView = computed(() => {
  const p = route.params.path;
  const s = Array.isArray(p) ? p.join('/') : p || '';
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

const goHome = async () => {
  await router.push('/browse/');
};

const toggleSelectionMode = () => {
  fileStore.toggleSelectionMode({ clearOnDisable: true });
};
</script>

<template>
  <div class="sticky top-0 z-40 bg-white/90 p-3 backdrop-blur dark:bg-default/90">
    <div class="flex flex-wrap items-center shrink-0">
      <button
        type="button"
        class="-ml-1 mr-1.5 rounded-md p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 lg:hidden"
        :aria-label="$t('browser.openSidebar')"
        @click="$emit('toggle-sidebar')"
      >
        <Bars3Icon class="h-6 w-6" />
      </button>

      <CreateNew v-if="canCreate" class="mr-3" />

      <div
        class="flex items-center max-sm:order-2 max-sm:basis-full max-sm:bg-zinc-100 max-sm:dark:bg-zinc-800 max-sm:p-1 max-sm:my-1 max-sm:rounded-xl"
      >
        <button
          v-if="!isVolumesView"
          type="button"
          class="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 md:hidden"
          :aria-label="$t('nav.home')"
          :title="$t('nav.home')"
          @click="goHome"
        >
          <HomeIcon class="h-5 w-5" />
        </button>
        <NavButtons />
        <BreadCrumb class="ml-2 mr-auto" />
        <button
          v-if="isTouchDevice && !isVolumesView"
          type="button"
          class="ml-2 shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="
            fileStore.selectionMode
              ? 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
              : 'bg-white text-neutral-700 hover:bg-neutral-100 dark:bg-neutral-900/40 dark:text-neutral-200 dark:hover:bg-neutral-800'
          "
          @click="toggleSelectionMode"
        >
          {{ fileStore.selectionMode ? $t('common.done') : $t('common.select') }}
        </button>
      </div>

      <div class="flex items-center ml-auto">
        <template v-if="!isVolumesView">
          <MenuItemInfo class="ml-auto" />
          <MenuShare />
          <div class="h-8 w-px mx-1 md:mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
          <MenuSortBy />
          <div class="h-8 w-px mx-1 md:mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
          <ViewMode />
          <PhotoSizeControl v-if="settings.view === 'photos'" />
          <div class="max-md:hidden h-8 w-px mx-1 md:mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
        </template>
        <NotificationBell />
        <SearchBar />
      </div>
    </div>
  </div>
</template>

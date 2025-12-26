<script setup>
import { computed, ref, watch } from 'vue';
import HeaderLogo from '@/components/HeaderLogo.vue';
import FavMenu from '@/components/FavMenu.vue';
import VolMenu from '@/components/VolMenu.vue';
import TerminalMenu from '@/components/TerminalMenu.vue';
import SharesMenu from '@/components/SharesMenu.vue';
import UploadProgress from '@/components/UploadProgress.vue';
import UserMenu from '@/components/UserMenu.vue';
import NotificationToastContainer from '@/components/NotificationToastContainer.vue';
import NotificationPanel from '@/components/NotificationPanel.vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import {
  useTitle,
  useStorage,
  useEventListener,
  useMediaQuery,
} from '@vueuse/core';

import PreviewHost from '@/plugins/preview/PreviewHost.vue';
import ExplorerContextMenu from '@/components/ExplorerContextMenu.vue';
import TerminalPanel from '@/components/TerminalPanel.vue';
import { useAuthStore } from '@/stores/auth';
import InfoPanel from '@/components/InfoPanel.vue';
import { useFileUploader } from '@/composables/fileUploader';
import { useClipboardShortcuts } from '@/composables/clipboardShortcuts';
import SpotlightSearch from '@/components/SpotlightSearch.vue';
import FavoriteEditDialog from '@/components/FavoriteEditDialog.vue';
import {
  Bars3Icon,
  ArrowRightOnRectangleIcon,
  InformationCircleIcon,
} from '@heroicons/vue/24/outline';
import FolderViewToolbar from '@/components/FolderViewToolbar.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

// Resizable aside state
const asideWidth = useStorage('browser-aside-width', 230);
const isDragging = ref(false);
const minAsideWidth = 200;
const maxAsideWidth = 460;
let startX = 0;
let startWidth = 0;

function onPointerDown(e) {
  isDragging.value = true;
  startX = e.clientX;
  startWidth = asideWidth.value;
  // Prevent selecting text while dragging
  document.body.classList.add('select-none');
}

useEventListener(window, 'pointermove', (e) => {
  if (!isDragging.value) return;
  const delta = e.clientX - startX;
  const next = Math.min(
    maxAsideWidth,
    Math.max(minAsideWidth, startWidth + delta),
  );
  asideWidth.value = next;
  e.preventDefault();
});

useEventListener(window, 'pointerup', () => {
  if (!isDragging.value) return;
  isDragging.value = false;
  document.body.classList.remove('select-none');
});

const isDesktop = useMediaQuery('(min-width: 1024px)');
const isSidebarOpen = ref(false);

function openSidebar() {
  isSidebarOpen.value = true;
}

function closeSidebar() {
  isSidebarOpen.value = false;
}

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value;
}

watch(isDesktop, (desktop) => {
  if (desktop) closeSidebar();
});

watch(
  () => route.fullPath,
  () => {
    closeSidebar();
  },
);

watch(isSidebarOpen, (open) => {
  document.body.classList.toggle('overflow-hidden', open && !isDesktop.value);
});

useEventListener(window, 'keydown', (e) => {
  if (e.key === 'Escape' && isSidebarOpen.value) {
    closeSidebar();
  }
});

const currentPathName = computed(() => {
  const p = route.params.path;
  const s = Array.isArray(p) ? p.join('/') : p || '';
  return s.split('/').filter(Boolean).pop() || 'Volumes';
});
useTitle(currentPathName);

const showBrowseToolbar = computed(() =>
  String(route.path || '').startsWith('/browse'),
);

// Ensure Uppy is initialized app-wide and bound to current path
useFileUploader();

// Global clipboard keyboard shortcuts for the browser layout
useClipboardShortcuts();

const handleGuestLogin = () => {
  // Redirect to login with current path as redirect
  router.push({
    name: 'auth-login',
    query: { redirect: route.fullPath },
  });
};
</script>

<template>
  <div class="relative flex w-full min-h-dvh">
    <aside
      class="flex flex-col bg-default-muted dark:bg-default-muted pt-4 pb-2 px-6 shrink-0 fixed inset-y-0 left-0 transition-transform duration-200 ease-in-out z-50 lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0"
      :class="isSidebarOpen ? 'translate-x-0' : '-translate-x-full'"
      :style="{ width: asideWidth + 'px' }"
    >
      <HeaderLogo appname="Explorer" />

      <!-- Guest Info Card -->
      <div
        v-if="auth.isGuest"
        class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
      >
        <div class="flex items-start gap-3 mb-3">
          <InformationCircleIcon
            class="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"
          />
          <div>
            <h3
              class="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1"
            >
              Guest Access
            </h3>
            <p class="text-xs text-blue-700 dark:text-blue-300">
              You're viewing a shared item. Sign in to access your files and all
              features.
            </p>
          </div>
        </div>
        <button
          @click="handleGuestLogin"
          class="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition"
        >
          <ArrowRightOnRectangleIcon class="w-4 h-4" />
          Sign In
        </button>
      </div>

      <div class="overflow-y-auto -mx-6 px-6 mt-6 scroll-on-hover">
        <FavMenu v-if="!auth.isGuest" />
        <SharesMenu v-if="!auth.isGuest" />
        <VolMenu v-if="!auth.isGuest" />
        <TerminalMenu />
      </div>
      <UserMenu v-if="!auth.isGuest" class="mt-auto -mx-4" />
    </aside>

    <!-- Resizer handle -->
    <div
      class="relative w-px cursor-col-resize bg-transparent group select-none hidden lg:block"
      @pointerdown="onPointerDown"
      :aria-label="$t('browser.resizeSidebar')"
    >
      <!-- Visual guide line -->
      <div
        class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-neutral-200 dark:bg-neutral-900 group-hover:bg-neutral-500"
      ></div>
    </div>

    <main class="flex min-w-0 flex-col grow relative bg-default shadow-lg">
      <FolderViewToolbar
        v-if="showBrowseToolbar"
        @toggle-sidebar="toggleSidebar"
      />

      <!-- Mobile-only toggle for non-browse views (keeps existing view layouts unchanged) -->
      <button
        v-else-if="!isDesktop && !isSidebarOpen"
        type="button"
        class="fixed left-2 top-2 z-40 rounded-md p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700"
        :aria-label="$t('browser.openSidebar')"
        @click="openSidebar"
      >
        <Bars3Icon class="h-6 w-6" />
      </button>

      <ExplorerContextMenu>
        <div class="flex min-h-0 flex-1 flex-col">
          <RouterView v-slot="{ Component, route: viewRoute }">
            <component
              :is="Component"
              :key="viewRoute.fullPath"
              class="min-h-0 flex-1"
            />
          </RouterView>
        </div>
      </ExplorerContextMenu>
    </main>

    <!-- Backdrop to close sidebar on small screens -->
    <button
      v-if="isSidebarOpen && !isDesktop"
      type="button"
      class="fixed inset-0 bg-black/20 z-40 lg:hidden"
      :aria-label="$t('browser.closeSidebar')"
      @click="closeSidebar"
    ></button>
    <UploadProgress class="z-550" />
    <PreviewHost />
    <InfoPanel />
    <SpotlightSearch />
    <FavoriteEditDialog />
    <NotificationToastContainer />
    <NotificationPanel />
    <TerminalPanel />
  </div>
</template>

<style scoped>
.scroll-on-hover {
  overflow-y: hidden;
}
.scroll-on-hover:hover {
  overflow-y: scroll;
}
</style>

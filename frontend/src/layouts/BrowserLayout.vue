<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import HeaderLogo from '@/components/HeaderLogo.vue';
import FavMenu from '@/components/FavMenu.vue';
import VolMenu from '@/components/VolMenu.vue';
import TerminalMenu from '@/components/TerminalMenu.vue';
import CreateNew from '@/components/CreateNew.vue';
import UploadProgress from '@/components/UploadProgress.vue';
import UserMenu from '@/components/UserMenu.vue';
import NotificationToastContainer from '@/components/NotificationToastContainer.vue';
import NotificationPanel from '@/components/NotificationPanel.vue';
import { RouterView, useRoute } from 'vue-router'
import { useTitle, useStorage, useEventListener } from '@vueuse/core'

import MenuSortBy from '@/components/MenuSortBy.vue'
import PreviewHost from '@/plugins/preview/PreviewHost.vue';
import ExplorerContextMenu from '@/components/ExplorerContextMenu.vue';
import TerminalPanel from '@/components/TerminalPanel.vue';
import { useSettingsStore } from '@/stores/settings';
import InfoPanel from '@/components/InfoPanel.vue';
import { useFileUploader, useUppyDropTarget } from '@/composables/fileUploader';
import { useUppyStore } from '@/stores/uppyStore';
import { useFileStore } from '@/stores/fileStore';
import { useClipboardShortcuts } from '@/composables/clipboardShortcuts';
import SpotlightSearch from '@/components/SpotlightSearch.vue';
import FavoriteEditDialog from '@/components/FavoriteEditDialog.vue';


const route = useRoute()
const settings = useSettingsStore()

// Resizable aside state
const asideWidth = useStorage('browser-aside-width', 230)
const isDragging = ref(false)
const minAsideWidth = 200
const maxAsideWidth = 460
let startX = 0
let startWidth = 0

function onPointerDown(e){
  isDragging.value = true
  startX = e.clientX
  startWidth = asideWidth.value
  // Prevent selecting text while dragging
  document.body.classList.add('select-none')
}

useEventListener(window, 'pointermove', (e) => {
  if(!isDragging.value) return
  const delta = e.clientX - startX
  const next = Math.min(maxAsideWidth, Math.max(minAsideWidth, startWidth + delta))
  asideWidth.value = next
  e.preventDefault()
})

useEventListener(window, 'pointerup', () => {
  if(!isDragging.value) return
  isDragging.value = false
  document.body.classList.remove('select-none')
})

const currentPathName = computed(() => {
const p = route.params.path;
const s = Array.isArray(p) ? p.join('/') : (p || '');
return s.split('/').filter(Boolean).pop() || 'Volumes';
});
useTitle(currentPathName)

// Check if we're at the volumes home view (no path selected)
const isVolumesView = computed(() => {
  const p = route.params.path;
  const s = Array.isArray(p) ? p.join('/') : (p || '');
  return !s || s.trim() === '';
});


// Ensure Uppy is initialized app-wide and bound to current path
useFileUploader();
const uppyStore = useUppyStore();
const fileStore = useFileStore();
const dropTargetRef = ref(null);
useUppyDropTarget(dropTargetRef);

// Global clipboard keyboard shortcuts for the browser layout
useClipboardShortcuts();

</script>

<template>

  <div class="relative flex w-full h-full">
    <!-- Tailwind-only toggle via hidden peer checkbox (must be sibling of sidebar) -->
    <input id="sidebar-toggle" type="checkbox" class="peer hidden" />

    <aside
      class="flex flex-col bg-base-muted dark:bg-base-muted pt-4 pb-2 px-6 shrink-0
      fixed inset-y-0 left-0 -translate-x-full transition-transform duration-200 ease-in-out z-40
      peer-checked:translate-x-0 lg:static lg:translate-x-0"
      :style="{ width: asideWidth + 'px' }"
    >
      <HeaderLogo appname="Explorer"/>
      <CreateNew v-if="!isVolumesView" class="mt-6"/> 
      <div class="overflow-y-scroll -mx-6 px-6 scroll-on-hover">
        <FavMenu/>
        <VolMenu/>
        <TerminalMenu/>
      </div>
      <UserMenu class="mt-auto -mx-4"/>
    </aside>

    <!-- Resizer handle -->
    <div
      class="relative w-[2px] cursor-col-resize bg-transparent group select-none hidden lg:block"
      @pointerdown="onPointerDown"
      :aria-label="$t('browser.resizeSidebar')"
    >
      <!-- Visual guide line -->
      <div class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-neutral-200 dark:bg-neutral-700 group-hover:bg-neutral-500"></div>
    </div>

    <main
      ref="dropTargetRef"
      class="upload-drop-target flex flex-col grow relative bg-base shadow-lg"
    >
      




      <ExplorerContextMenu>
        <div class="overflow-y-auto grow h-full pb-0.5">
          <router-view :key="route.fullPath">
          </router-view>
        </div>
      </ExplorerContextMenu>
    </main>
  
  <!-- Backdrop to close sidebar on small screens -->
  <label for="sidebar-toggle" class="fixed inset-0 bg-black/20 z-30 hidden lg:hidden peer-checked:block"></label>
  <UploadProgress class="z-550"/>
  <PreviewHost/>
  <InfoPanel/>
  <SpotlightSearch/>
  <FavoriteEditDialog/>
  <NotificationToastContainer/>
  <NotificationPanel/>
  <TerminalPanel/>
  </div>

</template>

<style scoped>
/* Minimal visual hint when dragging over the main area */
.upload-drop-target.uppy-is-drag-over {
  outline: 2px dashed rgba(59, 130, 246, 0.6); /* tailwind blue-500 */
  outline-offset: -2px;
}

.scroll-on-hover {
  overflow-y: hidden;
}
.scroll-on-hover:hover {
  overflow-y: scroll;
}
</style>

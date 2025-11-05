<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
// import { useDropZone } from '@vueuse/core'
import HeaderLogo from '@/components/HeaderLogo.vue';
import FavMenu from '@/components/FavMenu.vue';
import VolMenu from '@/components/VolMenu.vue';
import CreateNew from '@/components/CreateNew.vue';
import ViewMode from '@/components/ViewMode.vue';
import BreadCrumb from '@/components/BreadCrumb.vue';
import NavButtons from '@/components/NavButtons.vue';
import SearchBar from '@/components/SearchBar.vue';
import MenuItemInfo from '@/components/MenuItemInfo.vue';
import UploadProgress from '@/components/UploadProgress.vue';
import UserMenu from '@/components/UserMenu.vue';
import { RouterView, useRoute } from 'vue-router'
import { useTitle, useStorage, useEventListener } from '@vueuse/core'

import MenuSortBy from '@/components/MenuSortBy.vue'
import PreviewHost from '@/plugins/preview/PreviewHost.vue';
import ExplorerContextMenu from '@/components/ExplorerContextMenu.vue';
// import TerminalPanel from '@/components/TerminalPanel.vue';
import { useSettingsStore } from '@/stores/settings';
import PhotoSizeControl from '@/components/PhotoSizeControl.vue';
import InfoPanel from '@/components/InfoPanel.vue';
import { useFileUploader } from '@/composables/fileUploader';
import { useUppyStore } from '@/stores/uppyStore';
import { useFileStore } from '@/stores/fileStore';
import DropTarget from '@uppy/drop-target';
import { useClipboardShortcuts } from '@/composables/clipboardShortcuts';


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
  if(route.params.path==''){
    return 'Volumes';
  }
  if (typeof route.params.path === 'string') {
    const segments = route.params.path.split("/");
    return segments.pop(); 
  }
  
})

useTitle(currentPathName)


// Ensure Uppy is initialized app-wide and bound to current path
useFileUploader();
const uppyStore = useUppyStore();
const fileStore = useFileStore();
const dropTargetRef = ref(null);

onMounted(() => {
  const el = dropTargetRef.value;
  const uppy = uppyStore.uppy;
  if (el && uppy) {
    try {
      uppy.use(DropTarget, { target: el });
    } catch (_) {
      // ignore if plugin already mounted or target missing
    }
  }
});

onBeforeUnmount(() => {
  const uppy = uppyStore.uppy;
  if (uppy) {
    const plugin = uppy.getPlugin && uppy.getPlugin('DropTarget');
    if (plugin) uppy.removePlugin(plugin);
  }
});

// Global clipboard keyboard shortcuts for the browser layout
useClipboardShortcuts();



</script>

<template>

  <div class="relative flex w-full h-full">
    <!-- Tailwind-only toggle via hidden peer checkbox (must be sibling of sidebar) -->
    <input id="sidebar-toggle" type="checkbox" class="peer hidden" />

    <aside
      class="flex flex-col bg-nextgray-100 dark:bg-zinc-800 lg:dark:bg-opacity-70 p-4 px-4 shrink-0
      fixed inset-y-0 left-0 -translate-x-full transition-transform duration-200 ease-in-out z-40
      peer-checked:translate-x-0 lg:static lg:translate-x-0"
      :style="{ width: asideWidth + 'px' }"
    >
      <HeaderLogo />
      <CreateNew />
      <FavMenu />
      <VolMenu />
      <UserMenu class="mt-auto"/>
    </aside>

    <!-- Resizer handle -->
    <div
      class="relative w-1 cursor-col-resize bg-transparent group select-none hidden lg:block"
      @pointerdown="onPointerDown"
      aria-label="Resize sidebar"
    >
      <!-- Visual guide line -->
      <div class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-neutral-200 dark:bg-neutral-700 group-hover:bg-neutral-500"></div>
    </div>

    <main
      ref="dropTargetRef"
      class="upload-drop-target flex flex-col grow relative dark:bg-opacity-95 dark:bg-zinc-800 shadow-lg"
    >
      

       <div class="flex items-center p-6 py-4 shadow-md mb-4 dark:bg-nextgray-700 dark:bg-opacity-50">
        <!-- Hamburger (small screens) -->
        <label for="sidebar-toggle" class="lg:hidden -ml-2 mr-3 p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 inline-flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6">
            <path fill-rule="evenodd" d="M3.75 5.25a.75.75 0 01.75-.75h15a.75.75 0 010 1.5H4.5a.75.75 0 01-.75-.75zm0 6a.75.75 0 01.75-.75h15a.75.75 0 010 1.5H4.5a.75.75 0 01-.75-.75zm0 6a.75.75 0 01.75-.75h15a.75.75 0 010 1.5H4.5a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
          </svg>
        </label>
        
        <NavButtons />
        <BreadCrumb class="mr-auto "/>

        <MenuItemInfo/>
        <div class="h-8 w-[1px] mx-1 md:mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
        <MenuSortBy/>
        <div class="h-8 w-[1px] mx-1 md:mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
        <ViewMode/>
        <PhotoSizeControl />
        <div class="h-8 w-[1px] mx-1 md:mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
        <SearchBar/>

        <!-- <div 
        style="background:url('http://gravatar.com/userimage/106458114/6eb8be0fbf770f939299c3e5f67ff6da.jpeg?size=256'); background-size: contain"
        class="ml-4 h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center font-bold">
        </div> -->
      </div>

      <ExplorerContextMenu>
        <div class="p-6 pt-0 overflow-y-auto grow">
          <router-view :key="route.fullPath">
          </router-view>
        </div>
      </ExplorerContextMenu>

      <!-- Drop target gets visual state via CSS class from @uppy/drop-target -->
      
      
      <!-- <hr class="h-px border-0 bg-nextgray-400 dark:bg-neutral-700 mb-4" /> -->
      <!-- <div>
        <TerminalPanel/>
      </div> -->
    </main>
  
  <!-- Backdrop to close sidebar on small screens -->
  <label for="sidebar-toggle" class="fixed inset-0 bg-black/20 z-30 hidden lg:hidden peer-checked:block"></label>
  <UploadProgress/>
  <PreviewHost/>
  <InfoPanel/>
  </div>

</template>

<style scoped>
/* Minimal visual hint when dragging over the main area */
.upload-drop-target.uppy-is-drag-over {
  outline: 2px dashed rgba(59, 130, 246, 0.6); /* tailwind blue-500 */
  outline-offset: -2px;
}
</style>

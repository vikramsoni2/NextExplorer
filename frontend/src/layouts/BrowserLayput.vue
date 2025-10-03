<script setup>
import { computed, ref, watch } from 'vue';
// import { useDropZone } from '@vueuse/core'
import HeaderLogo from '@/components/HeaderLogo.vue';
import FavMenu from '@/components/FavMenu.vue';
import VolMenu from '@/components/VolMenu.vue';
import CreateNew from '@/components/CreateNew.vue';
import ViewMode from '@/components/ViewMode.vue';
import BreadCrumb from '@/components/BreadCrumb.vue';
import NavButtons from '@/components/NavButtons.vue';
import SearchBar from '@/components/SearchBar.vue';
import MenuClipboard from '@/components/MenuClipboard.vue';
import UploadProgress from '@/components/UploadProgress.vue';
import SettingsBar from '@/components/SettingsBar.vue';
import MenuItemInfo from '@/components/MenuItemInfo.vue';
import { RouterView, useRoute } from 'vue-router'
import { useTitle } from '@vueuse/core'

import MenuSortBy from '@/components/MenuSortBy.vue'
import PreviewHost from '@/plugins/preview/PreviewHost.vue';
// import TerminalPanel from '@/components/TerminalPanel.vue';


const route = useRoute()

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




</script>

<template>

  <div class="relative flex w-full h-full">

    <aside class="w-[230px] bg-nextgray-100 dark:bg-zinc-800 dark:bg-opacity-70 p-6 px-5 shrink-0">
      <HeaderLogo />
      <CreateNew />
      <FavMenu />
      <VolMenu />
    </aside>

    <main class="flex flex-col grow
    dark:bg-opacity-95 dark:bg-zinc-800 shadow-lg">
      

       <div class="flex items-center p-6 py-4 shadow-md mb-4 dark:bg-nextgray-700 dark:bg-opacity-50">
        
        <NavButtons />
        <BreadCrumb class="mr-auto "/>

        <MenuClipboard/>
        <div class="h-8 w-[1px] mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
        <MenuItemInfo/>
        <div class="h-8 w-[1px] mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
        <MenuSortBy/>
        <div class="h-8 w-[1px] mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
        <ViewMode/>
        <div class="h-8 w-[1px] mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
        <SettingsBar/>

        <!-- <div 
        style="background:url('http://gravatar.com/userimage/106458114/6eb8be0fbf770f939299c3e5f67ff6da.jpeg?size=256'); background-size: contain"
        class="ml-4 h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center font-bold">
        </div> -->
      </div>

      <div class="p-6 pt-0 overflow-y-auto grow">
        <router-view :key="route.fullPath">
        </router-view>
      </div>
      <!-- <hr class="h-px border-0 bg-nextgray-400 dark:bg-neutral-700 mb-4" /> -->
      <!-- <div>
        <TerminalPanel/>
      </div> -->
    </main>
  <UploadProgress/>
  <PreviewHost/>
  </div>

</template>

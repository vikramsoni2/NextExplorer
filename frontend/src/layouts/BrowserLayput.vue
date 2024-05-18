<script setup>
import { computed } from 'vue';
// import { useDropZone } from '@vueuse/core'
import HeaderLogo from '@/components/HeaderLogo.vue';
import FavMenu from '@/components/FavMenu.vue';
import VolMenu from '@/components/VolMenu.vue';
import CreateNew from '@/components/CreateNew.vue';
import ViewMode from '@/components/ViewMode.vue';
import BreadCrumb from '@/components/BreadCrumb.vue';
import NavButtons from '@/components/NavButtons.vue';
import SearchBar from '@/components/SearchBar.vue';
import UploadProgress from '@/components/UploadProgress.vue';

import { RouterView, useRoute } from 'vue-router'
import { useTitle } from '@vueuse/core'

import MenuSortBy from '@/components/MenuSortBy.vue'

const route = useRoute()

const currentPathName = computed(() => {
  if (typeof route.params.path === 'string') {
    const segments = route.params.path.split("/");
    return segments.pop(); // Safely return the last segment if available.
  }
  return 'Volumes';
})



useTitle(currentPathName)


// const dropZoneRef = ref(null)


// function onDrop(files) {
//   console.log('Files dropped:', files)
// }

// const { isOverDropZone } = useDropZone(dropZoneRef, {
//   onDrop,
//   // specify the types of data to be received.
//   // dataTypes: ['image/jpeg']
// })


// onMounted(() => {
//   console.log('mounted')
//   const dropzone = new Dropzone("div.my-dropzone", { url: "/file/post" });
// })

// import { Dropzone } from "dropzone";





</script>

<template>

  <div class="relative flex w-full h-full">

    <aside class="w-[230px] bg-nextgray-200 dark:bg-neutral-900 p-6 px-5 shrink-0 ">
      <HeaderLogo />
      <CreateNew />
      <FavMenu />
      <VolMenu />
    </aside>

    <main class="flex flex-col p-6 overflow-scroll grow dark:bg-opacity-95 dark:bg-neutral-800 shadow-lg">
      <div>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold ">{{ currentPathName }}</h2>
          <SearchBar/>
        </div>
        <div class="flex items-center my-3 mt-5">
          <NavButtons />
          <BreadCrumb />
          
          <MenuSortBy/>
          <div class="h-8 w-[1px] mx-3 bg-neutral-200 dark:bg-neutral-700"></div>
          <ViewMode/>
        </div>
        <hr class=" -ml-6 -mr-6 h-px my-3 border-0 bg-nextgray-400 dark:bg-neutral-700" />
      </div>

      <div class="overflow-y-scroll grow">
        <router-view :key="route.fullPath">
        </router-view>
      </div>
    </main>
    

  <UploadProgress/>
  </div>

</template>
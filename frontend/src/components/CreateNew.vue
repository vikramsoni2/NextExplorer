<script setup>
import { ref, watch } from 'vue'
import {PlusIcon} from '@heroicons/vue/24/outline'
import { useToggle, onClickOutside } from '@vueuse/core'
import {CreateNewFolderRound, UploadFileRound, DriveFolderUploadRound} from '@vicons/material'
import { useRoute } from 'vue-router';



const popuplRef  = ref(null)

const [menuOpen, toggle] = useToggle()

onClickOutside(
  popuplRef,
  (event) => {
    menuOpen.value = false
  },
)

import { useFileUploader } from '@/composables/fileUploader';

const {files, openDialog } = useFileUploader({'url':'http://localhost:3020/upload'});

const uploadFolder = async ()=>{
  await openDialog({directory: true})
  //process()
}

const uploadFiles = async ()=>{
  await openDialog()
  //process()
}

</script>
<template>
  <div class="relative">
    <button 
    @click="toggle()"
    class="box-border flex items-center justify-center gap-2 p-2 pl-3 pr-5 mb-4 
    shadow-md text-md rounded-lg
    dark:text-white
    bg-white hover:bg-opacity-80 active:bg-opacity-60 
    dark:bg-zinc-600 dark:hover:bg-opacity-90 dark:active:bg-opacity-80 ">
      <PlusIcon class="w-6 h-6"/>
      Create New
    </button>
    <div 
    ref="popuplRef"
    v-if="menuOpen"
    class="
    absolute top-0
    dark:bg-zinc-700 rounded-lg shadow-lg">
      <div class="cursor-pointer w-full flex items-center gap-2 p-2 px-4 hover:bg-zinc-600 border-b border-gray-600 rounded-t-lg"> <CreateNewFolderRound class="w-5 text-yellow-400"/> New Folder</div>
      <div 
      @click="uploadFiles"
      class="cursor-pointer w-full flex items-center gap-2 p-2 px-4 hover:bg-zinc-600">
        <UploadFileRound class="w-5"/>File Upload</div>
      <div 
      @click="uploadFolder"
      class="cursor-pointer w-full flex items-center gap-2 p-2 px-4 hover:bg-zinc-600 rounded-b-lg">
        <DriveFolderUploadRound class="w-5"/>Folder Upload
      </div>
    </div>
    
  </div>
</template>
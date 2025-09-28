<script setup>
import { ref } from 'vue'
import {PlusIcon} from '@heroicons/vue/24/outline'
import { useToggle, onClickOutside } from '@vueuse/core'
import {CreateNewFolderRound, UploadFileRound, DriveFolderUploadRound} from '@vicons/material'



const popuplRef  = ref(null)

const [menuOpen, toggle] = useToggle()

onClickOutside(
  popuplRef,
  () => {
    menuOpen.value = false
  },
)

import { useFileUploader } from '@/composables/fileUploader';
import { useFileStore } from '@/stores/fileStore';

const { openDialog } = useFileUploader();
const fileStore = useFileStore();
const isCreating = ref(false);

const uploadFolder = async ()=>{
  await openDialog({directory: true})
  //process()
}

const uploadFiles = async ()=>{
  await openDialog()
  //process()
}

const createFolder = async () => {
  if (isCreating.value) return;

  isCreating.value = true;
  try {
    await fileStore.createFolder();
  } catch (error) {
    console.error('Failed to create folder', error);
  } finally {
    menuOpen.value = false;
    isCreating.value = false;
  }
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
    bg-white dark:bg-zinc-700 rounded-lg shadow-lg">
      <button
      @click="createFolder"
      :disabled="isCreating"
      class="cursor-pointer w-full flex items-center gap-2 p-2 px-4 hover:bg-blue-500 hover:text-white border-b border-gray-300 dark:border-gray-600 rounded-t-lg disabled:opacity-60 disabled:cursor-not-allowed"> <CreateNewFolderRound class="w-5 text-yellow-400"/> New Folder</button>
      <button 
      @click="uploadFiles"
      class="cursor-pointer w-full flex items-center gap-2 p-2 px-4 hover:bg-blue-500 hover:text-white">
        <UploadFileRound class="w-5"/>File Upload</button>
      <button 
      @click="uploadFolder"
      class="cursor-pointer w-full flex items-center gap-2 p-2 px-4 hover:bg-blue-500 hover:text-white rounded-b-lg">
        <DriveFolderUploadRound class="w-5"/>Folder Upload
      </button>
    </div>
    
  </div>
</template>

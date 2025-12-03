<script setup>
import { ref } from 'vue'
import {PlusIcon} from '@heroicons/vue/24/outline'
import { useToggle, onClickOutside } from '@vueuse/core'
import {CreateNewFolderRound, 
  UploadFileRound, 
  DriveFolderUploadRound, 
  InsertDriveFileRound,
  DriveFolderUploadOutlined,
  UploadFileOutlined,
  FileOpenOutlined
} from '@vicons/material'



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

const createFile = async () => {
  if (isCreating.value) return;

  isCreating.value = true;
  try {
    await fileStore.createFile();
  } catch (error) {
    console.error('Failed to create file', error);
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
      class="inline-flex items-center justify-center rounded-lg 
      bg-neutral-900
      dark:bg-neutral-600/60 hover:bg-neutral-600 active:bg-neutral-700
      px-2 py-1.5 text-xs font-medium text-white
      shadow-sm transition
      md:px-3 md:pl-2 md:py-2 md:text-sm"
      :title="$t('create.createNew')"
    >
      <PlusIcon class="w-4 h-4 md:mr-1" />
      <span class="hidden md:inline">
        {{ $t('create.createNew') }}
      </span>
    </button>

    <div
    ref="popuplRef"
    v-if="menuOpen"
    class="
    absolute top-full mt-2 left-0 z-50 min-w-[200px]
    bg-white dark:bg-zinc-700 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-600">
      <button
      @click="createFolder"
      :disabled="isCreating"
      class="cursor-pointer w-full flex items-center gap-2 p-2 px-4 hover:bg-blue-500 hover:text-white border-b border-gray-300 dark:border-gray-600 rounded-t-lg disabled:opacity-60 disabled:cursor-not-allowed">
        <CreateNewFolderRound class="w-6 text-yellow-400"/> {{ $t('actions.newFolder') }}</button>
      <button
      @click="createFile"
      :disabled="isCreating"
      class="cursor-pointer w-full flex items-center gap-2 p-2 px-4 hover:bg-blue-500 hover:text-white border-b border-gray-300 dark:border-gray-600 disabled:opacity-60 disabled:cursor-not-allowed">
        <FileOpenOutlined class="w-6 text-orange-400"/>{{ $t('actions.newFile') }}</button>
      <button
      @click="uploadFiles"
      class="cursor-pointer w-full flex items-center gap-2 p-2 px-4 hover:bg-blue-500 hover:text-white border-b border-gray-300 dark:border-gray-600">
        <UploadFileOutlined class="w-6 text-sky-400"/>{{ $t('actions.fileUpload') }}</button>
      <button
      @click="uploadFolder"
      class="cursor-pointer w-full flex items-center gap-2 p-2 px-4 hover:bg-blue-500 hover:text-white rounded-b-lg">
        <DriveFolderUploadOutlined class="w-6 text-green-400"/>{{ $t('actions.folderUpload') }}
      </button>
    </div>

  </div>
</template>

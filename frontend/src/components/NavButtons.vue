<script setup>
import {ChevronLeft16Filled, ChevronRight16Filled} from '@vicons/fluent'
import {ArrowUp} from '@vicons/tabler'

import { useRouter} from 'vue-router';

const router = useRouter();

const goOneDirUp = () => {
  const path = decodeURIComponent(router.currentRoute.value.path);
  const segments = path.split('/').slice(2);
  // console.log(segments);
  if (segments.length > 0) {
    segments.pop();
    router.push({ path: `/browse/${segments.join('/')}` });
  }
}


</script>
<template>
    <button 
    @click="router.go(-1)"
    class="p-[6px] rounded-md dark:hover:bg-zinc-700 dark:active:bg-zinc-600 mr-2">
      <ChevronLeft16Filled class="h-6"/>
    </button>
    <button 
    @click="router.go(1)"
    class="p-[6px] rounded-md dark:hover:bg-zinc-700 dark:active:bg-zinc-600 mr-2">
      <ChevronRight16Filled class="h-6"/>
    </button>
    <button 
    @click="goOneDirUp"
    class="p-[6px] rounded-md dark:hover:bg-zinc-700 dark:active:bg-zinc-600 mr-6">
      <ArrowUp class="h-6"/>
    </button>
</template>
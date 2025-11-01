<script setup>
import {ChevronLeft16Filled, ChevronRight16Filled} from '@vicons/fluent'
import {ArrowUp} from '@vicons/tabler'
import { useNavigation } from '@/composables/navigation';

const { goNext, goPrev, goUp } = useNavigation();
</script>
<template>
    <button 
    @click="goPrev"
    class="p-[6px] rounded-md dark:hover:bg-zinc-700 dark:active:bg-zinc-600 mr-2"
    title="Back">
      <ChevronLeft16Filled class="h-6"/>
    </button>
    <button 
    @click="goNext"
    class="p-[6px] rounded-md dark:hover:bg-zinc-700 dark:active:bg-zinc-600 mr-2"
    title="Forward">
      <ChevronRight16Filled class="h-6"/>
    </button>
    <button 
    @click="goUp"
    class="p-[6px] rounded-md dark:hover:bg-zinc-700 dark:active:bg-zinc-600 mr-6"
    title="Up one folder">
      <ArrowUp class="h-6"/>
    </button>
</template>

<script setup>
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import { useSpotlightStore } from '@/stores/spotlight';

const spotlight = useSpotlightStore();

function openSpotlight() {
  spotlight.open();
}
</script>

<template>
  <div class="flex items-center">
    <button
      class="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[rgb(239,239,240)] active:bg-zinc-200 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      :title="$t('search.openShortcutTitle')"
      @click="openSpotlight"
    >
      <MagnifyingGlassIcon class="w-[1.36rem]" />
      <!-- <span class="hidden md:block text-sm text-neutral-600 dark:text-neutral-300">{{$t('search.search')}}</span>
      <span class="hidden md:flex items-center gap-1 ml-1 text-[11px] text-neutral-500 dark:text-neutral-400">
        
        <span class="px-1.5 py-[2px] rounded-sm border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800">⌘K</span>
      </span> -->
    </button>
  </div>
</template>

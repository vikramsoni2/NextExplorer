<script setup>
import { ChevronLeft16Filled, ChevronRight16Filled } from '@vicons/fluent';
import { ArrowUp } from '@vicons/tabler';
import { useNavigation } from '@/composables/navigation';

const { goNext, goPrev, goUp } = useNavigation();
</script>
<template>
  <div class="flex items-center">
    <button
      @click="goPrev"
      class="p-1.5 rounded-md dark:hover:bg-zinc-700 dark:active:bg-zinc-600 mr-1"
      :title="$t('nav.back')"
    >
      <ChevronLeft16Filled class="h-5" />
    </button>
    <button
      @click="goNext"
      class="p-1.5 rounded-md dark:hover:bg-zinc-700 dark:active:bg-zinc-600 mr-1"
      :title="$t('nav.forward')"
    >
      <ChevronRight16Filled class="h-5" />
    </button>
    <button
      @click="goUp"
      class="p-1.5 rounded-md dark:hover:bg-zinc-700 dark:active:bg-zinc-600 mr-2"
      :title="$t('nav.upOneFolder')"
    >
      <ArrowUp class="h-5" />
    </button>
  </div>
</template>

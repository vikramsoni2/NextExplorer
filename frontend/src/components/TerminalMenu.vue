<script setup>
import { CommandLineIcon } from '@heroicons/vue/24/outline'
import { useTerminalStore } from '@/stores/terminal'

const terminalStore = useTerminalStore()
const { toggle } = terminalStore
</script>

<template>
  <div>
    <h4
      class="group flex items-center justify-between pb-1 pt-6 text-sm
      text-neutral-400 dark:text-neutral-500 font-medium">
      Tools
    </h4>
    <button
      @click="toggle"
      class="cursor-pointer flex w-full items-center gap-3 rounded-lg transition-colors duration-200 text-sm
             hover:bg-neutral-100 dark:hover:bg-zinc-700 p-2 -ml-2"
    >
      <CommandLineIcon class="h-[1.38rem]"/> Terminal
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { CommandLineIcon } from '@heroicons/vue/24/outline';
import { useI18n } from 'vue-i18n';
import { useTerminalStore } from '@/stores/terminal';
import { useAuthStore } from '@/stores/auth';

const terminalStore = useTerminalStore();
const { toggle } = terminalStore;

const auth = useAuthStore();
const isAdmin = computed(
  () => Array.isArray(auth.currentUser?.roles) && auth.currentUser.roles.includes('admin'),
);

const { t } = useI18n();
</script>

<template>
  <div v-if="isAdmin">
    <h4
      class="group flex items-center justify-between pb-1 pt-2 text-sm
      text-neutral-400 dark:text-neutral-500 font-medium"
    >
      {{ t('terminal.menuHeading') }}
    </h4>
    <button
      @click="toggle"
      class="cursor-pointer flex w-full items-center gap-3 rounded-lg transition-colors duration-200 text-sm
             hover:bg-neutral-100 dark:hover:bg-zinc-700 p-2 -ml-2"
    >
      <CommandLineIcon class="h-[1.38rem]" /> {{ t('terminal.menuOpen') }}
    </button>
  </div>
</template>

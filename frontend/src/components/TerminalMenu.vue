<script setup>
import { computed, ref } from 'vue';
import { CommandLineIcon, ChevronDownIcon } from '@heroicons/vue/24/outline';
import { useI18n } from 'vue-i18n';
import { useTerminalStore } from '@/stores/terminal';
import { useAuthStore } from '@/stores/auth';

const terminalStore = useTerminalStore();
const { toggle, isOpen } = terminalStore;

const auth = useAuthStore();
const isAdmin = computed(
  () => Array.isArray(auth.currentUser?.roles) && auth.currentUser.roles.includes('admin'),
);

const { t } = useI18n();

const open = ref(true);
</script>

<template>
  <div v-if="isAdmin">
    <h4
      class="group flex items-center justify-between pt-2 text-sm
      text-neutral-400 dark:text-neutral-500
      font-medium"
    >
      {{ t('terminal.menuHeading') }}
      <button
        @click="open = !open"
        class="hidden group-hover:block
        active:text-black
        dark:active:text-white
        text-neutral-500"
      >
        <ChevronDownIcon
          class="h-4 transition-transform duration-300 ease-in-out"
          :class="{ 'rotate-0': open, '-rotate-90': !open }"
        />
      </button>
    </h4>
    <div class="overflow-hidden">
      <transition
        enter-active-class="transition-all duration-500"
        leave-active-class="transition-all duration-500"
        enter-from-class="-mt-[100%]"
        enter-to-class="mt-0"
        leave-from-class="mt-0"
        leave-to-class="-mt-[100%]"
      >
        <div v-if="open" class="overflow-hidden">
          <button
            @click="toggle"
            :class="[
              'cursor-pointer flex w-full items-center gap-3 my-3 rounded-lg transition-colors duration-200 text-sm',
              isOpen ? 'dark:text-white' : 'dark:text-neutral-300/90'
            ]"
          >
            <CommandLineIcon class="h-[1.38rem]" /> {{ t('terminal.menuOpen') }}
          </button>
        </div>
      </transition>
    </div>
  </div>
</template>

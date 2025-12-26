<script setup>
import { ref } from 'vue';
import { onClickOutside } from '@vueuse/core';
import { useSettingsStore } from '@/stores/settings';
import { AdjustmentsHorizontalIcon } from '@heroicons/vue/24/outline';
import { useI18n } from 'vue-i18n';

const settings = useSettingsStore();
const { t } = useI18n();

const menuOpen = ref(false);
const menuPopup = ref(null);

onClickOutside(menuPopup, () => {
  menuOpen.value = false;
});
</script>

<template>
  <div class="relative z-10" v-if="settings.view === 'photos'">
    <button
      @click="menuOpen = !menuOpen"
      class="p-[6px] rounded-md hover:bg-[rgb(239,239,240)] active:bg-zinc-200 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      :class="{ 'dark:bg-zinc-700 dark:bg-opacity-70': menuOpen }"
      :title="t('photos.menuTitle')"
      :aria-label="t('photos.menuAria')"
    >
      <AdjustmentsHorizontalIcon class="w-6" />
    </button>

    <transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <div
        v-if="menuOpen"
        ref="menuPopup"
        class="absolute right-0 mt-1 w-64 origin-top-right rounded-md bg-zinc-100 dark:bg-neutral-700 shadow-md border border-neutral-200 dark:border-neutral-600 p-3"
      >
        <div class="flex items-center justify-between mb-2">
          <span
            class="text-xs text-neutral-600 dark:text-neutral-300 select-none"
            >{{ t('photos.thumbnailSize') }}</span
          >
          <span
            class="text-xs text-neutral-500 dark:text-neutral-400 select-none"
            >{{ settings.photoSize }}px</span
          >
        </div>
        <input
          type="range"
          min="80"
          max="320"
          step="4"
          v-model.number="settings.photoSize"
          class="w-full h-1.5 accent-blue-600"
          :aria-label="t('photos.thumbnailSize')"
        />
      </div>
    </transition>
  </div>
</template>


<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { onClickOutside } from '@vueuse/core';
import { useSettingsStore } from '@/stores/settings'
import { AlignSpaceAroundVertical20Regular } from '@vicons/fluent';
import {
  Squares2X2Icon,
  ListBulletIcon,
  PhotoIcon,
} from '@heroicons/vue/24/outline'
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/vue/20/solid';

const settings = useSettingsStore()
const { t } = useI18n();

const menuOpen = ref(false)
const menuPopup = ref(null)

const viewOptions = [
  {
    key: 'list',
    get label() { return t('view.list'); },
    icon: ListBulletIcon,
    activate: () => settings.listView()
  },
  {
    key: 'tab',
    get label() { return t('view.column'); },
    icon: AlignSpaceAroundVertical20Regular,
    activate: () => settings.tabView()
  },
  {
    key: 'grid',
    get label() { return t('view.grid'); },
    icon: Squares2X2Icon,
    activate: () => settings.gridView()
  },
  {
    key: 'photos',
    get label() { return t('view.photos'); },
    icon: PhotoIcon,
    activate: () => settings.photosView()
  }
]

const activeView = computed(() => viewOptions.find(option => option.key === settings.view) ?? viewOptions[0])

onClickOutside(menuPopup, () => {
  menuOpen.value = false
})

</script>

<template>

  <div class="flex gap-1 items-center">
    <div class="hidden md:flex gap-1 items-center">
      <button
        v-for="option in viewOptions"
        :key="option.key"
        @click="option.activate"
        class="p-1.5 rounded-md hover:bg-[rgb(239,239,240)] active:bg-zinc-200 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
        :class="{ 'bg-[rgb(239,239,240)] dark:bg-zinc-700': settings.view === option.key }"
        :title="option.label"
      >
        <component :is="option.icon" class="w-6" />
      </button>
    </div>

    <div class="relative md:hidden">
      <button
        @click="menuOpen = !menuOpen"
        class="flex items-center gap-1 p-[6px] rounded-md hover:bg-[rgb(239,239,240)] active:bg-zinc-200 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
        :class="{ 'bg-[rgb(239,239,240)] dark:bg-zinc-700': menuOpen }"
        :title="activeView?.label"
      >
        <component :is="activeView?.icon" class="w-6" />
        <ChevronUpDownIcon class="w-4 h-4" />
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
          class="absolute right-0 mt-1 w-40 origin-top-right rounded-md divide-y divide-gray-100 bg-zinc-100 dark:bg-neutral-700 shadow-md border border-neutral-200 dark:border-neutral-600"
        >
          <div class="flex flex-col gap-1 p-1">
            <button
              v-for="option in viewOptions"
              :key="option.key"
              @click="option.activate(); menuOpen = false"
              class="flex items-center gap-2 p-[2px] px-2 rounded-md text-left hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 dark:active:bg-blue-600 dark:focus:bg-blue-600"
              :class="{ 'dark:bg-blue-600 bg-blue-500 text-white': settings.view === option.key }"
            >
              <CheckIcon
                class="h-4 w-4 dark:text-white invisible"
                :class="{ 'visible!': settings.view === option.key }"
              />
              <span>{{ option.label }}</span>
            </button>
          </div>
        </div>
      </transition>
    </div>
  </div>

</template>

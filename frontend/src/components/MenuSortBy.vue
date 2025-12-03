<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { SortByAlphaOutlined } from '@vicons/material';
import { useSettingsStore } from '@/stores/settings'
import { onClickOutside } from '@vueuse/core';
import { CheckIcon } from '@heroicons/vue/20/solid';

const settings = useSettingsStore()
const { t } = useI18n();

function sortLabel(option){
  if (option.by === 'name' && option.order === 'asc') return t('sort.nameAToZ')
  if (option.by === 'name' && option.order === 'desc') return t('sort.nameZToA')
  if (option.by === 'size' && option.order === 'asc') return t('sort.smallToLarge')
  if (option.by === 'size' && option.order === 'desc') return t('sort.largeToSmall')
  if (option.by === 'dateModified' && option.order === 'asc') return t('sort.oldToNew')
  if (option.by === 'dateModified' && option.order === 'desc') return t('sort.newToOld')
  return option.name
}

const menuOpen = ref(false)
const menuPopup = ref(null)

onClickOutside(menuPopup, () => {
  menuOpen.value = false
})

</script>

<template>

  <div class="relative">
    <button @click="menuOpen = !menuOpen" 
      class="p-1.5 rounded-md 
      hover:bg-[rgb(239,239,240)] active:bg-zinc-200
      dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      :class="{ 'dark:bg-zinc-700 dark:bg-opacity-70': menuOpen == true }"
      :title="t('titles.sortOptions')">
      <SortByAlphaOutlined class="w-6" />
    </button>

    <transition 
      enter-active-class="transition duration-100 ease-out" 
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100" 
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100" 
      leave-to-class="transform scale-95 opacity-0">

      <div v-if="menuOpen" ref="menuPopup"
        class="absolute right-0 mt-1 w-40 origin-top-right rounded-md
        divide-y divide-gray-100 
         bg-zinc-100 dark:bg-neutral-700 shadow-md 
         border border-neutral-200 dark:border-neutral-600"
        >
        <div class="flex flex-col gap-1  p-1">

          <button v-for="option in settings.sortOptions"
            :key="option.key"
            @click="settings.setSortBy(option.key); menuOpen = false"
            class="
            flex items-center 
            gap-1 p-[2px] px-2 rounded-md text-left
            hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 dark:active:bg-blue-600 dark:focus:bg-blue-600"
            :class="{'dark:bg-blue-600': settings.sortBy.key === option.key}"
            >
            
            <CheckIcon 
            class="h-4 w-4  dark:text-white invisible"
            :class="{'visible!': settings.sortBy.key === option.key}"  />
            {{ sortLabel(option) }}
          </button>

        </div>
      </div>
    </transition>
  </div>










</template>

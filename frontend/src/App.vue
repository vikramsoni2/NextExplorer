<script setup>
import { RouterLink, RouterView } from 'vue-router'
import { 
  MagnifyingGlassIcon, 
  Squares2X2Icon,
  ListBulletIcon,
  Cog8ToothIcon } from '@heroicons/vue/24/outline'

import HeaderLogo from '@/components/HeaderLogo.vue';
import FavMenu from '@/components/FavMenu.vue';
import VolMenu from '@/components/VolMenu.vue';
import BreadCrumb from './components/BreadCrumb.vue';
import NavButtons from './components/NavButtons.vue';

import { useSettingsStore } from '@/stores/settings'
import { AlignSpaceAroundVertical20Regular } from '@vicons/fluent';

const settings = useSettingsStore()

import { useRoute } from 'vue-router';
import { computed } from 'vue';

const route = useRoute()

const currentPathName = computed(() => {
  if (typeof route.params.path === 'string') {
    const segments = route.params.path.split("/");
    return segments.pop(); // Safely return the last segment if available.
  }
  return 'Volumes';
})

</script>

<template>
  <div class="flex font-light grow">

    <aside class="w-[230px] bg-nextgray-200 dark:bg-nextgray-700 p-6 px-5 shrink-0">
      <HeaderLogo/>
      <FavMenu/>
      <VolMenu/>
    </aside>

    <main class="flex flex-col content-start h-screen p-6 dark:bg-opacity-95 grow dark:bg-neutral-800">
      
      <div>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold ">{{ currentPathName }}</h2>
          <div class="">
            <MagnifyingGlassIcon class="absolute h-5 mt-[6px] ml-2"/>
            <input type="text" placeholder="search" 
            class="p-2 py-1 pl-10 rounded-md dark:bg-zinc-700"/>
          </div>
        </div>
        <div class="flex items-center my-3 mt-5">
          <NavButtons/>
          <BreadCrumb/>
          <div class="flex gap-1 ml-auto"> 

            <button
            @click="settings.tabView"
            class="p-[6px] rounded-md dark:hover:bg-zinc-700 dark:active:bg-zinc-600" 
            :class="{'dark:bg-zinc-700 dark:bg-opacity-70':settings.view=='tab'}">
              <AlignSpaceAroundVertical20Regular class="w-6"/>
            </button>


            <button 
            @click="settings.listView"
            class="p-[6px] rounded-md dark:hover:bg-zinc-700 dark:active:bg-zinc-600" 
            :class="{'dark:bg-zinc-700 dark:bg-opacity-70':settings.view=='list'}">
              <ListBulletIcon class="w-6" />
            </button>
            <button 
            @click="settings.gridView"
            class="p-[6px] rounded-md dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
            :class="{'dark:bg-zinc-700 dark:bg-opacity-70':settings.view=='grid'}">
              <Squares2X2Icon class="w-6" />
            </button>


            <button class="ml-4"><Cog8ToothIcon class="w-6"/></button>
          </div>
        </div>
        <hr class="h-px my-3 border-0 bg-nextgray-400 dark:bg-neutral-700"/>
      </div>
      
      <div class="overflow-y-scroll">
        <router-view></router-view>
      </div>

      

    </main>
  </div>

</template>


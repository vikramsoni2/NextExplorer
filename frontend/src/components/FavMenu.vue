<script setup>
import { ref } from 'vue'
import { 
    ChevronDownIcon,
    PhotoIcon, 
    ComputerDesktopIcon, 
    MusicalNoteIcon, 
    FolderArrowDownIcon } from '@heroicons/vue/24/outline'

const open = ref(true);

</script>

<template>

        <h4 
        class="group flex items-center justify-between py-[6px] text-sm 
        text-neutral-400 dark:text-neutral-500 font-medium">
            Quick access 
            <button 
            @click="open = !open"
            class="hidden group-hover:block 
            active:text-black
            dark:active:text-white
            text-neutral-500">
                <ChevronDownIcon class="h-4 transition-transform duration-300 ease-in-out" :class="{'rotate-0': open, '-rotate-90': !open}" />
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
                <button class="flex w-full items-center gap-3 px-3 py-[6px] rounded-lg hover:bg-nextgray-300 dark:hover:bg-zinc-700"><ComputerDesktopIcon class="h-5"/> Desktop</button>
                <button class="flex w-full items-center gap-3 px-3 py-[6px] rounded-lg hover:bg-nextgray-300 dark:hover:bg-zinc-700"><MusicalNoteIcon class="h-5"/> Music</button>
                <button class="flex w-full items-center gap-3 px-3 py-[6px] rounded-lg hover:bg-nextgray-300 dark:hover:bg-zinc-700"><PhotoIcon class="h-5"/> Pictures</button>
                <button class="flex w-full items-center gap-3 px-3 py-[6px] rounded-lg hover:bg-nextgray-300 dark:hover:bg-zinc-700"><FolderArrowDownIcon class="h-5"/> Downloads</button>
            </div>
        </transition>
        </div>

        
</template>
<script setup>
import FileIcon from '@/icons/FileIcon.vue';
import { formatBytes, formatDate } from '@/utils';
import {useNavigation} from '@/composables/navigation';
import { useSelection } from '@/composables/itemSelection';

const emit = defineEmits(['click'])
const props = defineProps(['item', 'view'])

const {openItem} = useNavigation()
const {handleSelection, isSelected} = useSelection();

</script>

<template>

    <div 
    :title="item.name"
    v-if="view==='grid'"
    @click="handleSelection(item, $event)"
    @dblclick="openItem(item)"
    class="flex flex-col items-center gap-2 p-4 rounded-md cursor-pointer select-none"    
    > 
        <FileIcon 
        :item="item" 
        class="h-16 shrink-0"/> 
        <div class="text-sm text-center break-all line-clamp-2 rounded-md px-2 -mx-2 "
        :class="{'bg-blue-500 text-white dark:bg-blue-600': isSelected(item) }" 
        >{{ item.name }}</div>
    </div>


    <div 
    :title="item.name"
    v-if="view==='tab'"
    @click="handleSelection(item, $event)"
    @dblclick="openItem(item)"
    
    class="flex items-center gap-2 p-4 rounded-md cursor-pointer select-none">
        <FileIcon 
        :item="item" 
        class="w-16 shrink-0"/> 
        <div class="grow rounded-md px-2 -mx-2"
        :class="{'bg-blue-500 text-white dark:bg-blue-600': isSelected(item) }" >
            <div class="break-all line-clamp-2"
            >
            {{ item.name }}</div>
            <p class="text-xs text-stone-400">
                {{ formatBytes(item.size) }}
            </p>  
        </div>
    </div>

    <div 
    v-if="view==='list'"
    @click="handleSelection(item, $event)"
    @dblclick="openItem(item)"
    class="grid select-none items-center grid-cols-[30px_1fr_150px_200px] 
    cursor-pointer auto-cols-fr p-1 px-4 rounded-md
    even:bg-zinc-100 dark:even:bg-zinc-900 dark:even:bg-opacity-50
    "
    :class="{'text-white bg-blue-500 even:bg-blue-500  dark:bg-blue-600 dark:even:bg-blue-600 dark:bg-opacity-80 dark:even:bg-opacity-80': isSelected(item) }" 
     >
        
        <FileIcon 
        :item="item" 
        class="w-6 shrink-0"/> 
        <div :title="item.name" class="break-all text-sm line-clamp-1">{{ item.name }}</div>
        <div class="text-sm">
            {{ item.kind==="directory"? "&mdash;" : formatBytes(item.size) }}
        </div>
        <div class="text-sm">
            {{ formatDate(item.dateModified) }}
        </div>
    </div>

</template>
<script setup>
import FileIcon from '@/icons/FileIcon.vue';
import { useRouter, useRoute } from 'vue-router';
import { formatBytes, formatDate } from '@/utils';
import {useNavigation} from '@/composables/navigation';


const props = defineProps(['item', 'view'])

const {openItem} = useNavigation()


</script>

<template>

    <div 
    :title="props.item.name"
    v-if="props.view==='grid'"
    @dblclick="openItem(item)"
    class="flex flex-col items-center gap-2 p-4 rounded-md cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-700">
        <FileIcon 
        :kind="props.item.kind" 
        class="h-16 shrink-0"/> 
        <div class="text-sm text-center break-all line-clamp-2">{{ props.item.name }}</div>
    </div>


    <div 
    :title="props.item.name"
    v-if="props.view==='tab'"
    @dblclick="openItem(item)"
    class="flex items-center gap-2 p-4 rounded-md cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-700">
        <FileIcon 
        :kind="props.item.kind" 
        class="h-16 shrink-0"/> 
        <div>
            <div class="break-all line-clamp-2">{{ props.item.name }}</div>
            <p class="text-xs text-stone-500">
                {{ formatBytes(props.item.size) }}
            </p>  
        </div>
    </div>


    <div 
    v-if="props.view==='list'"
    @dblclick="openItem(item)"
    class="grid select-none items-center grid-cols-[30px_1fr_150px_200px] even:bg-zinc-100 dark:even:bg-zinc-700 even:bg-opacity-30 dark:even:bg-opacity-20 p-2 px-4 rounded-md cursor-pointer auto-cols-fr hover:bg-zinc-100 dark:hover:bg-zinc-700">
        
        <FileIcon 
        :kind="props.item.kind" 
        class="h-6 shrink-0"/> 
        <div :title="props.item.name" class="break-all line-clamp-1">{{ props.item.name }}</div>
        <div class="text-sm">
            {{ props.item.kind==="directory"? "---" : formatBytes(props.item.size) }}
        </div>
        <div class="text-sm">
            {{ formatDate(props.item.dateModified) }}
        </div>
    </div>

</template>
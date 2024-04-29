<script setup>
import {ServerIcon } from '@heroicons/vue/24/outline'

import {getVolumes} from '@/api'
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter()

const volumes = ref([])
onMounted(async () => {
    volumes.value = await getVolumes()
})

const browseVolume = (volumeName) => {
    router.push({ name: 'browse', params: {path: volumeName} });
}

</script>

<template>
    <div class="mt-6">
        <h4 class="py-[6px] text-sm text-neutral-400 font-medium">Volumes</h4>
        <div 
        v-for="volume in volumes" :key="volume.name"
        @click="browseVolume(volume.name)"
        class=" cursor-pointer flex items-center gap-3 px-3 py-[6px] rounded-lg hover:bg-nextgray-300 dark:hover:bg-zinc-700 dark:active:bg-zinc-600">
            <ServerIcon class="h-5"/> {{volume.name}}
        </div>
    </div>
</template>
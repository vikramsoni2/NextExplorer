<script setup>
import {ServerIcon, ChevronDownIcon } from '@heroicons/vue/24/outline'
import {getVolumes} from '@/api'
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import {useNavigation} from '@/composables/navigation';

const {openItem} = useNavigation()
const route = useRoute()

const volumes = ref([])

onMounted(async () => {
    try {
        volumes.value = await getVolumes()
    } catch (error) {
        console.error('Failed to load volumes', error)
    }
})

const open = ref(true);
const currentPath = computed(() => {
    const path = route.params.path;
    if (Array.isArray(path)) {
        return path.join('/');
    }
    return typeof path === 'string' ? path : '';
});

const activeVolumeName = computed(() => {
    const path = currentPath.value.trim();
    if (!path) {
        return '';
    }
    const segments = path.split('/').filter(Boolean);
    return segments[0] || '';
});

const isActiveVolume = (volumeName = '') => {
    if (typeof volumeName !== 'string') {
        return false;
    }
    return volumeName === activeVolumeName.value;
};

</script>

<template>
    <div>
    <h4 
    class="group flex items-center justify-between pb-2 pt-6 text-sm 
    text-neutral-400 dark:text-neutral-500 font-medium">
        {{ $t('volumes.title') }}
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
                <button 
                    v-for="volume in volumes" :key="volume.name"
                    @click="openItem(volume)"
                    :class="[
                        'cursor-pointer flex w-full items-center gap-3 my-3 rounded-lg transition-colors duration-200 text-sm',
                        isActiveVolume(volume.name)
                            ? 'dark:text-white'
                            : 'dark:text-neutral-300/80'
                    ]"
                >
                    <ServerIcon class="h-[1.38rem]"/> {{volume.name}}
                </button>
            </div>
        </transition>
    </div>
    </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useSettingsStore } from '@/stores/settings'
import FileObject from '@/components/FileObject.vue';
import { useNavStore } from '@/stores/navStore';
import LoadingIcon from '@/icons/LoadingIcon.vue';

const settings = useSettingsStore()
const navStore = useNavStore()
const route = useRoute()
const loading = ref(true)


const loadFiles = async()=>{
  const path = route.params.path || ''
  await navStore.fetchPathItems(path)
  loading.value = false
}

onMounted(loadFiles)

</script>

<template>
    
    <div v-if="!loading"
    :class="settings.view === 'grid' ? 'grid grid-cols-[repeat(auto-fill,6rem)] gap-2' : settings.view === 'tab'? 'grid grid-cols-[repeat(auto-fill,20rem)] gap-2':'flex flex-col gap-2'">
        <FileObject v-for="item in navStore.getCurrentPathItems" :key="item.name" :item="item" :view="settings.view"/>
    </div>

    <div v-else class="flex grow items-center h-full justify-center text-sm text-neutral-500 dark:text-neutral-400">
      
      <div class="flex  items-center pr-4 bg-neutral-300 dark:bg-black bg-opacity-20 rounded-lg">
        <LoadingIcon/> Loading
      </div>
      
    
    </div>

</template>

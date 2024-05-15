<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useSettingsStore } from '@/stores/settings'
import FileObject from '@/components/FileObject.vue';
import { useNavStore } from '@/stores/navStore';
import { browse } from '@/api';

const settings = useSettingsStore()
const navStore = useNavStore()
const route = useRoute()
const resources = ref(null)

const loadFiles = async()=>{
  const path = route.params.path || ''
  navStore.setCurrentPath(path);
  resources.value = await browse(path);
}

onMounted(loadFiles)

watch(route, (to, from) => {
  
  loadFiles()
});
</script>

<template>
    
    <div 
    :class="settings.view === 'grid' ? 'grid grid-cols-[repeat(auto-fill,6rem)] gap-2' : settings.view === 'tab'? 'grid grid-cols-[repeat(auto-fill,20rem)] gap-2':'flex flex-col gap-2'">
        <FileObject v-for="item in resources" :key="item.name" :item="item" :view="settings.view"/>
    </div>

</template>

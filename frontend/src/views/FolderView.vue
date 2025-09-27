<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useSettingsStore } from '@/stores/settings'
import FileObject from '@/components/FileObject.vue';
import { useFileStore } from '@/stores/fileStore';
import LoadingIcon from '@/icons/LoadingIcon.vue';
import { useSelection } from '@/composables/itemSelection';

const settings = useSettingsStore()
const fileStore = useFileStore()
const route = useRoute()
const loading = ref(true)
const selectedItems = ref([]);
const { clearSelection } = useSelection();

const loadFiles = async () => {
  loading.value = true
  const path = route.params.path || ''
  try {
    await fileStore.fetchPathItems(path)
  } catch (error) {
    console.error('Failed to load directory contents', error)
  } finally {
    loading.value = false
  }
}

onMounted(loadFiles)

// const toggleSelection = (item, event) => {
//   if (event.ctrlKey || event.metaKey) {
//     // Ctrl + Click: Toggle selection
//     const index = selectedItems.value.indexOf(item);
//     if (index === -1) {
//       selectedItems.value.push(item);
//     } else {
//       selectedItems.value.splice(index, 1);
//     }
//   } else if (event.shiftKey) {
//     // Shift + Click: Select range
//     const currentItems = fileStore.getCurrentPathItems;
//     const lastSelectedItem = selectedItems.value[selectedItems.value.length - 1];
//     const lastIndex = currentItems.indexOf(lastSelectedItem);
//     const currentIndex = currentItems.indexOf(item);

//     if (lastIndex === -1 || currentIndex === -1) {
//       selectedItems.value = [item];
//     } else {
//       const [start, end] = [lastIndex, currentIndex].sort((a, b) => a - b);
//       selectedItems.value = currentItems.slice(start, end + 1);
//     }
//   } else {
//     // Single Click: Single selection
//     selectedItems.value = [item];
//   }
// };

</script>

<template>
    
    <div v-if="!loading"
    :class="settings.view === 'grid' ? 'grid grid-cols-[repeat(auto-fill,6rem)] gap-2' : 
    settings.view === 'tab'? 'grid grid-cols-[repeat(auto-fill,20rem)] gap-2':
    'flex flex-col gap-[1px]'"
    @click.self="clearSelection()">
      <FileObject 
      v-for="item in fileStore.getCurrentPathItems" 
      :key="item.name" 
      :item="item" 
      :view="settings.view"
      />
    </div>

    <div v-else class="flex grow items-center h-full justify-center text-sm text-neutral-500 dark:text-neutral-400">
      <div class="flex  items-center pr-4 bg-neutral-300 dark:bg-black bg-opacity-20 rounded-lg">
        <LoadingIcon/> Loading
      </div>
    </div>

</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useSettingsStore } from '@/stores/settings'
import FileObject from '@/components/FileObject.vue';
import { useFileStore } from '@/stores/fileStore';
import LoadingIcon from '@/icons/LoadingIcon.vue';
import { useSelection } from '@/composables/itemSelection';
import { useExplorerContextMenu } from '@/composables/contextMenu';
import { isPreviewableImage } from '@/config/media';
import { ImagesOutline } from '@vicons/ionicons5';
import FolderViewToolbar from '@/components/FolderViewToolbar.vue';
import { useViewConfig } from '@/composables/useViewConfig';
import { DragSelect, DragSelectOption } from '@coleqiu/vue-drag-select';

const settings = useSettingsStore()
const fileStore = useFileStore()
const route = useRoute()
const { gridClasses, gridStyle, LIST_VIEW_GRID_COLS } = useViewConfig()
const loading = ref(true)
const selectedItems = ref([]);
const { clearSelection } = useSelection();
const contextMenu = useExplorerContextMenu();

const applySelectionFromQuery = () => {
  const selectName = typeof route.query?.select === 'string' ? route.query.select : '';
  if (!selectName) return;
  const match = fileStore.getCurrentPathItems.find((it) => it?.name === selectName);
  if (match) {
    fileStore.selectedItems = [match];
  }
};

const selectionModel = computed({
  get: () => fileStore.selectedItems,
  set: (val) => {
    // val is the new selection from drag-select (array of items)
    // We update the store.
    // Note: drag-select might replace the selection.
    // If we want to support modifiers, the library handles 'multiple' prop.
    fileStore.selectedItems = val;
  }
});

const loadFiles = async () => {
  loading.value = true
  const path = route.params.path || ''
  try {
    await fileStore.fetchPathItems(path)
    applySelectionFromQuery();
  } catch (error) {
    console.error('Failed to load directory contents', error)
  } finally {
    loading.value = false
  }
}

onMounted(loadFiles)

const handleBackgroundContextMenu = (event) => {
  if (!contextMenu || !event) return;
  contextMenu?.openBackgroundMenu(event);
};

const showNoPhotosMessage = computed(() => {
  if (loading.value) return false;
  if (settings.view !== 'photos') return false;

  const items = fileStore.getCurrentPathItems;
  if (items.length === 0) return false;

  // Check if any item is a photo
  const hasPhotos = items.some((item) => {
    const kind = (item?.kind || '').toLowerCase();
    return isPreviewableImage(kind);
  });

  return !hasPhotos;
});


</script>

<template>
  <div
    v-if="!loading"
    class="h-full relative flex flex-col max-h-screen"
    @click.self="clearSelection()"
    >

      <!-- Toolbar -->
    <FolderViewToolbar />

    <DragSelect
      v-model="selectionModel"
      :click-option-to-select="false"
      class="grow overflow-y-scroll px-2"
      @click.self="clearSelection()"
      @contextmenu.prevent="handleBackgroundContextMenu"
    >
      <div
        :class="[gridClasses, 'min-h-full']"
        :style="gridStyle"
      >
        <!-- Detail view header -->
        <div
          v-if="settings.view === 'list'"
          :class="['grid items-center', LIST_VIEW_GRID_COLS,
          'px-4 py-2 text-xs',
          'text-neutral-600 dark:text-neutral-300',
          'uppercase tracking-wide select-none sticky top-0',
          'bg-white dark:bg-base',
          'backdrop-blur-sm']"
        >
          <div></div>
          <div>{{ $t('folder.name') }}</div>
          <div>{{ $t('folder.size') }}</div>
          <div>{{ $t('folder.kind') }}</div>
          <div>{{ $t('folder.dateModified') }}</div>
        </div>

        <!-- <DragSelectOption
          v-for="item in fileStore.getCurrentPathItems"
          :key="item.name"
          :value="item"
          class="h-full"
        > -->
          <FileObject
            v-for="item in fileStore.getCurrentPathItems"
            :key="item.name"
            :item="item"
            :view="settings.view"
          />
        <!-- </DragSelectOption> -->

        <!-- No photos message -->
        <div v-if="showNoPhotosMessage" class="absolute inset-0 flex flex-col items-center justify-center min-h-[400px] text-center px-4">
          <div class="text-neutral-400 dark:text-neutral-500 mb-2">
            <ImagesOutline class="w-20 h-20 mx-auto mb-4 opacity-50"/>
          </div>
          <h3 class="text-lg font-medium text-neutral-700 dark:text-neutral-300 mb-2">{{ $t('folder.noPhotos') }}</h3>
          <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ $t('folder.noPhotosHint') }}</p>
        </div>
      </div>
    </DragSelect>

    

    </div>

    <div v-else class="flex grow items-center h-full justify-center text-sm text-neutral-500 dark:text-neutral-400">
      <div class="flex  items-center pr-4 bg-neutral-300 dark:bg-black bg-opacity-20 rounded-lg">
        <LoadingIcon/> {{ $t('folder.loading') }}
      </div>
  </div>

</template>

<script setup>
import { ref, onMounted, computed, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useSettingsStore } from '@/stores/settings';
import FileObject from '@/components/FileObject.vue';
import { useFileStore } from '@/stores/fileStore';
import LoadingIcon from '@/icons/LoadingIcon.vue';
import { useSelection } from '@/composables/itemSelection';
import { useExplorerContextMenu } from '@/composables/contextMenu';
import { isPreviewableImage } from '@/config/media';
import { ImagesOutline } from '@vicons/ionicons5';
import { useViewConfig } from '@/composables/useViewConfig';
import { DragSelect } from '@coleqiu/vue-drag-select';
import { useUppyDropTarget } from '@/composables/fileUploader';
import { FolderOpenIcon } from '@heroicons/vue/24/outline';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/vue/20/solid';
import { useEventListener } from '@vueuse/core';
import { useInputMode } from '@/composables/useInputMode';

const settings = useSettingsStore();
const fileStore = useFileStore();
const route = useRoute();
const { gridClasses, gridStyle } = useViewConfig();
const loading = ref(true);
const { clearSelection } = useSelection();
const contextMenu = useExplorerContextMenu();
const dropTargetRef = ref(null);
useUppyDropTarget(dropTargetRef);

const { isTouchDevice } = useInputMode();

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
  },
});

const loadFiles = async () => {
  loading.value = true;
  const path = route.params.path || '';
  try {
    await fileStore.fetchPathItems(path);
    applySelectionFromQuery();
  } catch (error) {
    console.error('Failed to load directory contents', error);
  } finally {
    loading.value = false;
  }
};

onMounted(loadFiles);

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

const showEmptyFolderMessage = computed(() => {
  if (loading.value) return false;
  return fileStore.getCurrentPathItems.length === 0;
});

const toggleSort = (by, defaultOrder = 'asc') => {
  const currentBy = settings.sortBy?.by;
  const currentOrder = settings.sortBy?.order;

  if (currentBy === by) {
    settings.setSort(by, currentOrder === 'asc' ? 'desc' : 'asc');
    return;
  }

  settings.setSort(by, defaultOrder);
};

const listColumns = [
  {
    key: 'name',
    labelKey: 'common.name',
    by: 'name',
    defaultOrder: 'asc',
    widthIndex: 1,
  },
  {
    key: 'size',
    labelKey: 'common.size',
    by: 'size',
    defaultOrder: 'desc',
    widthIndex: 2,
  },
  {
    key: 'kind',
    labelKey: 'folder.kind',
    by: 'kind',
    defaultOrder: 'asc',
    widthIndex: 3,
  },
  {
    key: 'dateModified',
    labelKey: 'folder.dateModified',
    by: 'dateModified',
    defaultOrder: 'desc',
    widthIndex: 4,
  },
];

const sortIndicator = (by) => {
  if (settings.sortBy?.by !== by) return null;
  return settings.sortBy?.order || null;
};

const resizeState = ref(null);
const bodyStyleBeforeResize = ref({ cursor: '', userSelect: '' });

const stopResize = () => {
  if (!resizeState.value) return;
  resizeState.value = null;
  document.body.style.cursor = bodyStyleBeforeResize.value.cursor;
  document.body.style.userSelect = bodyStyleBeforeResize.value.userSelect;
};

const startResize = (colIndex, event) => {
  if (!event) return;
  if (event.button !== undefined && event.button !== 0) return;

  const startWidth = Number(settings.listViewColumnWidths?.[colIndex]);
  if (!Number.isFinite(startWidth)) return;

  resizeState.value = { colIndex, startX: event.clientX, startWidth };
  bodyStyleBeforeResize.value = {
    cursor: document.body.style.cursor || '',
    userSelect: document.body.style.userSelect || '',
  };
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
};

useEventListener(window, 'pointermove', (event) => {
  const state = resizeState.value;
  if (!state) return;
  const deltaX = event.clientX - state.startX;
  settings.setListViewColumnWidth(state.colIndex, state.startWidth + deltaX);
});

useEventListener(window, 'pointerup', stopResize);
useEventListener(window, 'pointercancel', stopResize);

onBeforeUnmount(() => {
  stopResize();
});
</script>

<template>
  <div
    ref="dropTargetRef"
    class="upload-drop-target relative flex flex-col flex-1 min-h-0"
    @click.self="clearSelection()"
  >
    <template v-if="!loading">
      <DragSelect
        v-model="selectionModel"
        :click-option-to-select="false"
        :disabled="isTouchDevice || !!fileStore.renameState"
        class="grow px-2"
        @click.self="clearSelection()"
        @contextmenu.prevent="handleBackgroundContextMenu"
      >
        <div
          :class="[gridClasses, 'min-h-full', settings.view === 'list' ? 'overflow-x-auto' : '']"
          :style="gridStyle"
        >
          <!-- Detail view header -->
          <div
            v-if="settings.view === 'list'"
            :class="[
              'grid items-center',
              'px-4 py-2 text-xs',
              'text-neutral-600 dark:text-neutral-300',
              'uppercase tracking-wide select-none',
              'bg-white dark:bg-default',
              'backdrop-blur-sm',
              'min-w-max',
            ]"
            :style="{
              gridTemplateColumns: settings.listViewGridTemplateColumns,
            }"
          >
            <div></div>
            <div v-for="col in listColumns" :key="col.key" class="relative flex items-center">
              <button
                type="button"
                class="flex items-center gap-1 text-left hover:text-neutral-900 dark:hover:text-white"
                @click="toggleSort(col.by, col.defaultOrder)"
              >
                <span>{{ $t(col.labelKey) }}</span>
                <ChevronUpIcon v-if="sortIndicator(col.by) === 'asc'" class="h-3.5 w-3.5" />
                <ChevronDownIcon v-else-if="sortIndicator(col.by) === 'desc'" class="h-3.5 w-3.5" />
              </button>
              <div
                class="absolute -right-2 top-0 h-full w-4 cursor-col-resize touch-none"
                title="Resize"
                @pointerdown.stop.prevent="startResize(col.widthIndex, $event)"
                @dblclick.stop.prevent="settings.resetListViewColumnWidths()"
              >
                <div
                  class="mx-auto h-full w-px bg-transparent hover:bg-neutral-300 dark:hover:bg-neutral-600"
                ></div>
              </div>
            </div>
          </div>

          <FileObject
            v-for="item in fileStore.getCurrentPathItems"
            :key="(item.path || '') + '::' + item.name"
            :item="item"
            :view="settings.view"
          />

          <!-- No photos message -->
          <div
            v-if="showNoPhotosMessage || showEmptyFolderMessage"
            class="absolute inset-0 flex flex-col items-center justify-center min-h-[400px] text-center px-4"
          >
            <div class="text-neutral-400 dark:text-neutral-500 mb-2">
              <FolderOpenIcon v-if="showEmptyFolderMessage" class="w-16 h-16 mb-4 opacity-30" />
              <ImagesOutline v-else class="w-20 h-20 mx-auto mb-4 opacity-50" />
            </div>
            <h3 class="text-lg font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              {{ showEmptyFolderMessage ? $t('folder.empty') : $t('folder.noPhotos') }}
            </h3>
            <p class="text-sm text-neutral-500 dark:text-neutral-400">
              {{ showEmptyFolderMessage ? $t('folder.emptyHint') : $t('folder.noPhotosHint') }}
            </p>
          </div>
        </div>
      </DragSelect>
    </template>

    <template v-else>
      <div
        class="flex flex-1 items-center justify-center text-sm text-neutral-600 dark:text-neutral-300"
      >
        <div class="flex items-center pr-4 bg-neutral-200 dark:bg-zinc-700/50 rounded-xl">
          <LoadingIcon /> {{ $t('common.loading') }}
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.upload-drop-target.uppy-is-drag-over {
  outline: 2px dashed rgba(59, 130, 246, 0.6);
  outline-offset: -2px;
}
</style>

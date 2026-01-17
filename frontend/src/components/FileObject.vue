<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { onLongPress } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import FileIcon from '@/icons/FileIcon.vue';
import { formatBytes, formatDate } from '@/utils';
import { getKindLabel } from '@/utils/fileKinds';
import { useNavigation } from '@/composables/navigation';
import { useSelection } from '@/composables/itemSelection';
import { useFileStore } from '@/stores/fileStore';
import { useExplorerContextMenu } from '@/composables/contextMenu';
import { isPreviewableImage } from '@/config/media';
import { useSettingsStore } from '@/stores/settings';
import { DragSelectOption } from '@coleqiu/vue-drag-select';
import MiddleEllipsis from '@/components/MiddleEllipsis.vue';
import { ellipses } from '@/utils/ellipses';
import { useInputMode } from '@/composables/useInputMode';
import { CheckIcon } from '@heroicons/vue/20/solid';
import { useFileDragDrop } from '@/composables/useFileDragDrop';

const props = defineProps(['item', 'view']);
const settings = useSettingsStore();

const { openItem } = useNavigation();
const { handleSelection, isSelected, toggleSelection } = useSelection();
const fileStore = useFileStore();
const { renameState, selectionMode } = storeToRefs(fileStore);
const { canDragDrop, handleDragStart } = useFileDragDrop();
const contextMenu = useExplorerContextMenu();
const { isTouchDevice } = useInputMode();

const renameInputRef = ref(null);
const rootRef = ref(null);
const baseRenameInputClass =
  'w-full rounded-sm border border-blue-500 bg-white/90 px-1 py-0.5 text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-blue-400 dark:bg-zinc-700 dark:text-white dark:border-blue-300 dark:focus:ring-blue-300';

const isRenaming = computed(() => fileStore.isItemBeingRenamed(props.item));

const renameDraft = computed({
  get: () => {
    if (!isRenaming.value || !renameState.value) {
      return '';
    }
    return renameState.value.draft ?? '';
  },
  set: (value) => {
    if (isRenaming.value) {
      fileStore.setRenameDraft(value);
    }
  },
});

const isCut = computed(() =>
  fileStore.cutItems.some(
    (cutItem) =>
      cutItem.name === props.item.name && (cutItem.path || '') === (props.item.path || '')
  )
);

const showSelectionControl = computed(() => !isTouchDevice.value || selectionMode.value);

const selectionButtonBaseClass =
  'flex items-center justify-center border ring-1 ring-inset shadow-sm backdrop-blur-sm transition-opacity focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400';

const selectionButtonStateClass = (selected) =>
  selected
    ? 'border-blue-600 bg-blue-600 text-white ring-blue-600 dark:border-blue-500 dark:bg-blue-500 dark:ring-blue-500'
    : 'border-neutral-300 bg-white/80 text-transparent ring-neutral-200 dark:border-neutral-600 dark:bg-zinc-900/60 dark:ring-neutral-700';

const longPressActive = ref(false);

const handleToggleSelection = (event) => {
  if (isRenaming.value) return;
  event?.preventDefault?.();
  event?.stopPropagation?.();
  toggleSelection(props.item);
};

const handleClick = (event) => {
  if (isRenaming.value) return;
  if (!isTouchDevice.value) {
    handleSelection(props.item, event);
    return;
  }

  if (longPressActive.value) {
    longPressActive.value = false;
    return;
  }

  // Mobile behavior:
  // - Normal mode: tap opens.
  // - Selection mode: tap toggles selection (no open).
  if (selectionMode.value) {
    toggleSelection(props.item);
    return;
  }

  openItem(props.item);
};

const handleDblClick = () => {
  if (isRenaming.value) return;
  if (isTouchDevice.value && selectionMode.value) return;
  openItem(props.item);
};

const handleContextMenu = (event) => {
  if (isRenaming.value) return;
  contextMenu?.openItemMenu(event, props.item);
};

const selectRenameText = (input) => {
  if (!input) return;
  const value = input.value;
  const kind = renameState.value?.kind || props.item.kind;

  if (!value) {
    input.select();
    return;
  }

  if (kind === 'directory') {
    input.select();
    return;
  }

  const lastDot = value.lastIndexOf('.');
  if (lastDot > 0) {
    input.setSelectionRange(0, lastDot);
  } else {
    input.select();
  }
};

const focusRenameInput = async () => {
  await nextTick();
  const input = renameInputRef.value;
  if (!input) return;
  input.focus();
  selectRenameText(input);
};

watch(isRenaming, (value) => {
  if (value) {
    focusRenameInput();
  }
});

const commitRename = async () => {
  if (!isRenaming.value) return;
  try {
    await fileStore.applyRename();
  } catch (error) {
    console.error('Rename operation failed', error);
    if (error && error.message) {
      window.alert(error.message);
    }
    focusRenameInput();
  }
};

const cancelRename = () => {
  if (!isRenaming.value) return;
  fileStore.cancelRename();
};

const handleRenameKeydown = async (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    await commitRename();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    cancelRename();
  }
};

const handleRenameBlur = async () => {
  await commitRename();
};

// Kind label logic moved to '@/utils/fileKinds'

// Photos view helpers
const isPhotoItem = computed(() => {
  const kind = (props.item?.kind || '').toLowerCase();
  return isPreviewableImage(kind);
});

if (isTouchDevice.value) {
  onLongPress(
    rootRef,
    (ev) => {
      if (!ev || isRenaming.value) return;
      longPressActive.value = true;
      handleContextMenu(ev);
    },
    {
      delay: 500,
      distanceThreshold: 10,
    }
  );
}
</script>

<template>
  <DragSelectOption
    class="group/item"
    v-if="(view === 'photos' && isPhotoItem) || view != 'photos'"
    :value="props.item"
  >
    <div
      v-if="view === 'photos' && isPhotoItem"
      :title="item.name"
      ref="rootRef"
      @click="handleClick"
      @dblclick="handleDblClick"
      @contextmenu.prevent.stop="handleContextMenu"
      @dragstart="(e) => handleDragStart(e, item)"
      :draggable="canDragDrop() && !isRenaming"
      class="photo-cell relative w-full rounded-md overflow-hidden cursor-pointer select-none bg-neutral-100 dark:bg-zinc-800/60 hover:brightness-105"
      :class="{
        'ring-2 ring-blue-500 dark:ring-blue-400': isSelected(item),
        'opacity-60': isCut,
        'cursor-move': canDragDrop() && !isRenaming,
      }"
    >
      <button
        v-if="showSelectionControl"
        type="button"
        :class="[
          selectionButtonBaseClass,
          selectionButtonStateClass(isSelected(item)),
          selectionMode || isSelected(item)
            ? 'opacity-100'
            : 'opacity-0 group-hover/item:opacity-100',
          'absolute right-2 top-2 z-10 h-5 w-5 rounded-md',
        ]"
        :aria-label="`Select ${item.name}`"
        @click="handleToggleSelection"
        @dblclick.stop.prevent
      >
        <CheckIcon class="h-4 w-4" />
      </button>
      <FileIcon :item="item" class="w-full h-full" />
    </div>

    <div
      :title="item.name"
      v-if="view === 'grid'"
      ref="rootRef"
      @click="handleClick"
      @dblclick="handleDblClick"
      @contextmenu.prevent.stop="handleContextMenu"
      @dragstart="(e) => handleDragStart(e, item)"
      :draggable="canDragDrop() && !isRenaming"
      class="relative flex flex-col items-center gap-2 p-2 rounded-xl cursor-pointer select-none"
      :class="[
        { 'opacity-60': isCut },
        isSelected(item) ? 'bg-zinc-200/70 dark:bg-zinc-700/60' : '',
        canDragDrop() && !isRenaming ? 'cursor-move' : '',
      ]"
    >
      <button
        v-if="showSelectionControl"
        type="button"
        :class="[
          selectionButtonBaseClass,
          selectionButtonStateClass(isSelected(item)),
          selectionMode || isSelected(item)
            ? 'opacity-100'
            : 'opacity-0 group-hover/item:opacity-100',
          'absolute right-2 top-2 z-10 h-5 w-5 rounded-md',
        ]"
        :aria-label="`Select ${item.name}`"
        @click="handleToggleSelection"
        @dblclick.stop.prevent
      >
        <CheckIcon class="h-4 w-4" />
      </button>
      <FileIcon :item="item" class="h-16 shrink-0" />
      <div
        class="text-sm text-center break-all line-clamp-2 rounded-md"
        :class="{
          'bg-blue-500 text-white dark:bg-blue-600': isSelected(item) && !isRenaming,
        }"
      >
        <template v-if="isRenaming">
          <input
            ref="renameInputRef"
            v-model="renameDraft"
            type="text"
            :class="[baseRenameInputClass, 'text-center select-text']"
            @keydown.stop="handleRenameKeydown"
            @blur="handleRenameBlur"
            @click.stop
            @mousedown.stop
            autocomplete="off"
          />
        </template>
        <template v-else>
          {{ ellipses(item.name, (maxl = 15)) }}
        </template>
      </div>
    </div>

    <div
      :title="item.name"
      v-if="view === 'tab'"
      ref="rootRef"
      @click="handleClick"
      @dblclick="handleDblClick"
      @contextmenu.prevent.stop="handleContextMenu"
      @dragstart="(e) => handleDragStart(e, item)"
      :draggable="canDragDrop() && !isRenaming"
      class="relative flex items-center gap-2 p-4 rounded-md cursor-pointer select-none"
      :class="[
        { 'opacity-60': isCut },
        isSelected(item) ? 'bg-zinc-200/70 dark:bg-zinc-700/60' : '',
        canDragDrop() && !isRenaming ? 'cursor-move' : '',
      ]"
    >
      <button
        v-if="showSelectionControl"
        type="button"
        :class="[
          selectionButtonBaseClass,
          selectionButtonStateClass(isSelected(item)),
          selectionMode || isSelected(item)
            ? 'opacity-100'
            : 'opacity-0 group-hover/item:opacity-100',
          'absolute right-2 top-2 z-10 h-5 w-5 rounded-md',
        ]"
        :aria-label="`Select ${item.name}`"
        @click="handleToggleSelection"
        @dblclick.stop.prevent
      >
        <CheckIcon class="h-4 w-4" />
      </button>
      <FileIcon :item="item" class="w-16 shrink-0" />
      <div
        class="grow rounded-md px-2 -mx-2"
        :class="{
          'bg-blue-500 text-white dark:bg-blue-600': isSelected(item) && !isRenaming,
        }"
      >
        <div class="break-all line-clamp-2">
          <template v-if="isRenaming">
            <input
              ref="renameInputRef"
              v-model="renameDraft"
              type="text"
              :class="[baseRenameInputClass, 'select-text']"
              @keydown.stop="handleRenameKeydown"
              @blur="handleRenameBlur"
              @click.stop
              @mousedown.stop
              autocomplete="off"
            />
          </template>
          <template v-else>
            {{ ellipses(item.name, (maxl = 50)) }}
          </template>
        </div>
        <p class="text-xs text-stone-400">
          {{ formatBytes(item.size) }}
        </p>
      </div>
    </div>

    <div
      v-if="view === 'list'"
      ref="rootRef"
      @click="handleClick"
      @dblclick="handleDblClick"
      @contextmenu.prevent.stop="handleContextMenu"
      @dragstart="(e) => handleDragStart(e, item)"
      :draggable="canDragDrop() && !isRenaming"
      :class="[
        'grid select-none items-center',
        'cursor-pointer auto-cols-fr p-1 px-4 rounded-md',
        'min-w-max',
        'group-even/item:bg-zinc-100 dark:group-even/item:bg-neutral-700/30',
        {
          'text-white dark:text-white bg-blue-600 dark:bg-blue-600/80 group-even/item:bg-blue-600! dark:group-even/item:bg-blue-600/80!':
            isSelected(item),
          'opacity-60': isCut && !isSelected(item),
          'cursor-move': canDragDrop() && !isRenaming,
        },
      ]"
      :style="{ gridTemplateColumns: settings.listViewGridTemplateColumns }"
    >
      <div class="relative flex items-center justify-center">
        <FileIcon :item="item" class="w-6 shrink-0" />
        <button
          v-if="showSelectionControl"
          type="button"
          :class="[
            selectionButtonBaseClass,
            selectionButtonStateClass(isSelected(item)),
            selectionMode || isSelected(item)
              ? 'opacity-100'
              : 'opacity-0 group-hover/item:opacity-100',
            'absolute left-1/2 top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-md',
          ]"
          :aria-label="`Select ${item.name}`"
          @click="handleToggleSelection"
          @dblclick.stop.prevent
        >
          <CheckIcon class="h-4 w-4" />
        </button>
      </div>
      <div :title="item.name" class="min-w-0 overflow-hidden text-sm">
        <template v-if="isRenaming">
          <input
            ref="renameInputRef"
            v-model="renameDraft"
            type="text"
            :class="[baseRenameInputClass, 'py-1 select-text']"
            @keydown.stop="handleRenameKeydown"
            @blur="handleRenameBlur"
            @click.stop
            @mousedown.stop
            autocomplete="off"
          />
        </template>
        <template v-else>
          <MiddleEllipsis :text="item.name" :end-chars="10" />
        </template>
      </div>
      <div class="text-sm">
        {{ item.kind === 'directory' ? '&mdash;' : formatBytes(item.size) }}
      </div>
      <div class="text-sm">
        {{ getKindLabel(item) }}
      </div>
      <div class="text-sm">
        {{ formatDate(item.dateModified) }}
      </div>
    </div>
  </DragSelectOption>
</template>

<style scoped>
.photo-cell {
  aspect-ratio: 1 / 1;
}

.photo-cell :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>

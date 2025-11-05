<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  watch,
} from 'vue';
import { offset, flip, shift, useFloating } from '@floating-ui/vue';
import { explorerContextMenuSymbol } from '@/composables/contextMenu';
import { useFileStore } from '@/stores/fileStore';
import { useSelection } from '@/composables/itemSelection';
import { usePreviewManager } from '@/plugins/preview/manager';
import { useInfoPanelStore } from '@/stores/infoPanel';
import { normalizePath } from '@/api';
import ModalDialog from '@/components/ModalDialog.vue';
// Icons
import {
  CreateNewFolderRound,
  InsertDriveFileRound,
  ContentCutRound,
  ContentCopyRound,
  ContentPasteRound,
  DriveFileRenameOutlineRound,
  InfoRound,
  DeleteRound,
} from '@vicons/material';

const fileStore = useFileStore();
const previewManager = usePreviewManager();
const infoPanel = useInfoPanelStore();
const { clearSelection } = useSelection();

const isOpen = ref(false);
const pointer = ref({ x: 0, y: 0 });
const contextKind = ref('background'); // background | file | directory
const targetItem = ref(null);

const referenceRef = ref(null);
const floatingRef = ref(null);

const { x, y, strategy, update } = useFloating(referenceRef, floatingRef, {
  placement: 'right-start',
  middleware: [offset(4), flip(), shift()],
});

const floatingStyles = computed(() => ({
  position: strategy.value,
  left: `${Math.max(x.value ?? 0, 0)}px`,
  top: `${Math.max(y.value ?? 0, 0)}px`,
  zIndex: 1600,
}));

const referenceStyles = computed(() => ({
  position: 'fixed',
  left: `${pointer.value.x}px`,
  top: `${pointer.value.y}px`,
}));

const selectedItems = computed(() => fileStore.selectedItems);
const hasSelection = computed(() => selectedItems.value.length > 0);
const primaryItem = computed(() => selectedItems.value[0] ?? null);
const isSingleItemSelected = computed(() => selectedItems.value.length === 1);
const canRename = computed(() => {
  if (!isSingleItemSelected.value) return false;
  const item = primaryItem.value;
  if (!item) return false;
  return item.kind !== 'volume';
});

const deleteDialogTitle = computed(() => {
  const count = selectedItems.value.length;
  if (count === 1 && primaryItem.value) {
    return `Delete "${primaryItem.value.name}"?`;
  }
  if (count > 1) {
    return `Delete ${count} items?`;
  }
  return 'Delete items';
});

const deleteDialogMessage = computed(() => {
  const count = selectedItems.value.length;
  if (count === 1 && primaryItem.value) {
    return `Are you sure you want to delete "${primaryItem.value.name}"? This action cannot be undone.`;
  }
  if (count > 1) {
    return `Are you sure you want to delete these ${count} items? This action cannot be undone.`;
  }
  return 'No items selected.';
});

const isDeleteConfirmOpen = ref(false);
const isDeleting = ref(false);

const closeMenu = () => {
  isOpen.value = false;
};

const getItemKey = (item) => {
  if (!item || !item.name) return '';
  const parent = normalizePath(item.path || '');
  return `${parent}::${item.name}`;
};

const ensureItemInSelection = (item) => {
  if (!item) return;
  const key = getItemKey(item);
  const alreadySelected = fileStore.selectedItems
    .some((selected) => getItemKey(selected) === key);

  if (alreadySelected) {
    return;
  }

  const match = fileStore.getCurrentPathItems
    .find((candidate) => getItemKey(candidate) === key);

  fileStore.selectedItems = match ? [match] : [item];
};

const openMenuAt = (event, kind, item = null) => {
  if (!event) return;
  const clientX = event.clientX ?? 0;
  const clientY = event.clientY ?? 0;

  pointer.value = { x: clientX, y: clientY };
  contextKind.value = kind;
  targetItem.value = item;
  isOpen.value = true;
};

const openItemMenu = (event, item) => {
  if (!event || !item) return;
  event.preventDefault?.();
  ensureItemInSelection(item);
  openMenuAt(event, item.kind === 'directory' ? 'directory' : 'file', item);
};

const openBackgroundMenu = (event) => {
  if (!event) return;
  event.preventDefault?.();
  openMenuAt(event, 'background');
};

const resolveItemPath = (item) => {
  if (!item || !item.name) {
    return normalizePath(fileStore.getCurrentPath || '');
  }
  const parent = normalizePath(item.path || '');
  const combined = parent ? `${parent}/${item.name}` : item.name;
  return normalizePath(combined);
};

const runCut = () => {
  if (!fileStore.hasSelection) return;
  fileStore.cut();
};

const runCopy = () => {
  if (!fileStore.hasSelection) return;
  fileStore.copy();
};

const runPasteIntoDirectory = async () => {
  if (!fileStore.hasClipboardItems) return;
  const destination = resolveItemPath(targetItem.value);
  await fileStore.paste(destination);
};

const runPasteIntoCurrent = async () => {
  if (!fileStore.hasClipboardItems) return;
  await fileStore.paste();
};

const runCreateFile = async () => {
  await fileStore.createFile();
};

const runCreateFolder = async () => {
  await fileStore.createFolder();
};

const runRename = () => {
  if (!canRename.value || !primaryItem.value) return;
  fileStore.beginRename(primaryItem.value);
};

const requestDelete = () => {
  if (!hasSelection.value) return;
  isDeleteConfirmOpen.value = true;
};

const confirmDelete = async () => {
  if (!hasSelection.value || isDeleting.value) return;
  isDeleting.value = true;
  try {
    await fileStore.del();
    isDeleteConfirmOpen.value = false;
  } catch (error) {
    console.error('Delete operation failed', error);
  } finally {
    isDeleting.value = false;
  }
};

const runGetInfo = () => {
  if (!primaryItem.value) return;
  // Open right-side info panel with selected item
  infoPanel.open(primaryItem.value);
};

// Build grouped, themed menu sections with icons + shortcuts
const menuSections = computed(() => {
  if (!isOpen.value) return [];

  const mk = (id, label, icon, run, opts = {}) => ({
    id,
    label,
    icon,
    run,
    disabled: Boolean(opts.disabled),
    shortcut: opts.shortcut || '',
    danger: Boolean(opts.danger),
  });

  if (contextKind.value === 'background') {
    return [
      [
        mk('new-folder', 'New Folder', CreateNewFolderRound, runCreateFolder),
        mk('new-file', 'New File', InsertDriveFileRound, runCreateFile),
      ],
      [
        mk('paste', 'Paste', ContentPasteRound, runPasteIntoCurrent, {
          disabled: !fileStore.hasClipboardItems,
          shortcut: '⌘V',
        }),
      ],
      [
        mk('get-info', 'Get Info', InfoRound, runGetInfo, {
          disabled: !primaryItem.value,
        }),
      ],
    ];
  }

  const sections = [];
  sections.push([
    mk('get-info', 'Get Info', InfoRound, runGetInfo, { disabled: !primaryItem.value }),
  ]);

  const clipboardSection = [
    mk('cut', 'Cut', ContentCutRound, runCut, { disabled: !fileStore.hasSelection, shortcut: '⌘X' }),
    mk('copy', 'Copy', ContentCopyRound, runCopy, { disabled: !fileStore.hasSelection, shortcut: '⌘C' }),
  ];
  if (contextKind.value === 'directory') {
    clipboardSection.push(
      mk('paste', 'Paste', ContentPasteRound, runPasteIntoDirectory, { disabled: !fileStore.hasClipboardItems, shortcut: '⌘V' }),
    );
  }
  sections.push(clipboardSection);

  sections.push([
    mk('rename', 'Rename', DriveFileRenameOutlineRound, runRename, { disabled: !canRename.value }),
  ]);

  sections.push([
    mk('delete', 'Delete', DeleteRound, requestDelete, { disabled: !hasSelection.value, danger: true }),
  ]);

  return sections;
});

const runAction = async (action) => {
  if (!action || action.disabled) return;
  closeMenu();
  try {
    await action.run();
  } catch (error) {
    console.error(`Context menu action "${action.id}" failed`, error);
  }
};

const handleGlobalPointerDown = (event) => {
  if (!isOpen.value) return;
  const menu = floatingRef.value;
  if (menu && (menu === event.target || menu.contains(event.target))) {
    return;
  }
  closeMenu();
};

const handleGlobalKeydown = (event) => {
  if (event.key === 'Escape') {
    closeMenu();
  }
};

watch(isOpen, async (open) => {
  if (!open) return;
  await nextTick();
  update();
});

watch(pointer, async () => {
  if (!isOpen.value) return;
  await nextTick();
  update();
}, { deep: true });

onMounted(() => {
  window.addEventListener('pointerdown', handleGlobalPointerDown);
  window.addEventListener('keydown', handleGlobalKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handleGlobalPointerDown);
  window.removeEventListener('keydown', handleGlobalKeydown);
});

provide(explorerContextMenuSymbol, {
  openItemMenu,
  openBackgroundMenu,
  closeMenu,
  clearSelection,
});
</script>

<template>
  <slot />

  <div
    v-if="isOpen"
    ref="referenceRef"
    class="pointer-events-none h-0 w-0"
    :style="referenceStyles"
  />

  <teleport to="body">
    <div
      v-if="isOpen"
      ref="floatingRef"
      :style="floatingStyles"
      class="min-w-[220px] rounded-xl border border-white/10 bg-white/70 p-2 text-sm text-zinc-800 shadow-2xl backdrop-blur-xl dark:border-white/5 dark:bg-black/40 dark:text-zinc-200"
      @contextmenu.prevent
      @click.stop
    >
      <div v-for="(section, sIdx) in menuSections" :key="`section-${sIdx}`" class="flex flex-col gap-1">
        <button
          v-for="action in section"
          :key="action.id"
          type="button"
          class="flex h-8 w-full items-center gap-3 rounded-md px-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50"
          :class="[
            action.danger
              ? 'text-red-600 hover:bg-red-500/20 dark:text-red-500 dark:hover:bg-red-500/20'
              : 'hover:bg-zinc-500/20 dark:hover:bg-zinc-400/20',
          ]"
          :disabled="action.disabled"
          @click.stop="runAction(action)"
        >
          <component :is="action.icon" class="w-4 h-4 opacity-80" />
          <p class="flex-1 font-medium">{{ action.label }}</p>
          <span v-if="action.shortcut" class="ml-auto text-xs text-zinc-500 dark:text-zinc-400">{{ action.shortcut }}</span>
          <span v-if="action.disabled" class="sr-only">Disabled</span>
        </button>

        <div
          v-if="sIdx < menuSections.length - 1"
          class="my-1 h-px bg-zinc-300/50 dark:bg-zinc-700/50"
        />
      </div>
    </div>
  </teleport>

  <ModalDialog v-model="isDeleteConfirmOpen">
    <template #title>{{ deleteDialogTitle }}</template>
    <p class="mb-6 text-base text-zinc-700 dark:text-zinc-200">
      {{ deleteDialogMessage }}
    </p>
    <div class="flex justify-end gap-3">
      <button
        type="button"
        class="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 active:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
        @click="isDeleteConfirmOpen = false"
        :disabled="isDeleting"
      >
        Cancel
      </button>
      <button
        type="button"
        class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 active:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-500 dark:hover:bg-red-400"
        @click="confirmDelete"
        :disabled="isDeleting"
      >
        <span v-if="isDeleting">Deleting...</span>
        <span v-else>Delete</span>
      </button>
    </div>
  </ModalDialog>
</template>

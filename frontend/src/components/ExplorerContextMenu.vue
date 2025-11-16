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
import { useI18n } from 'vue-i18n';
import { explorerContextMenuSymbol } from '@/composables/contextMenu';
import { useFileStore } from '@/stores/fileStore';
import { useSelection } from '@/composables/itemSelection';
import { useFileActions } from '@/composables/fileActions';
import { usePreviewManager } from '@/plugins/preview/manager';
import { useInfoPanelStore } from '@/stores/infoPanel';
import { normalizePath } from '@/api';
import { modKeyLabel, deleteKeyLabel } from '@/utils/keyboard';
import { useDeleteConfirm } from '@/composables/useDeleteConfirm';
import ModalDialog from '@/components/ModalDialog.vue';
import { useFavoritesStore } from '@/stores/favorites';
import { StarIcon as StarOutline } from '@heroicons/vue/24/outline';
import { StarIcon as StarSolid } from '@heroicons/vue/24/solid';
import { useFavoriteEditor } from '@/composables/useFavoriteEditor';
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
const favoritesStore = useFavoritesStore();
const { openEditorForFavorite } = useFavoriteEditor();

const isOpen = ref(false);
const pointer = ref({ x: 0, y: 0 });
const contextKind = ref('background'); // background | file | directory
const targetItem = ref(null);
const isMutatingFavorite = ref(false);

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

const actions = useFileActions();
const { t } = useI18n();
const selectedItems = actions.selectedItems;
const hasSelection = actions.hasSelection;
const primaryItem = actions.primaryItem;
const isSingleItemSelected = actions.isSingleItemSelected;
const canRename = actions.canRename;

const deleteDialogTitle = computed(() => {
  const count = selectedItems.value.length;
  if (count === 1 && primaryItem.value) {
    return t('context.deleteTitle.single', { name: primaryItem.value.name });
  }
  if (count > 1) {
    return t('context.deleteTitle.multiple', { count });
  }
  return t('context.deleteTitle.generic');
});

const deleteDialogMessage = computed(() => {
  const count = selectedItems.value.length;
  if (count === 1 && primaryItem.value) {
    return t('context.deleteMessage.single', { name: primaryItem.value.name });
  }
  if (count > 1) {
    return t('context.deleteMessage.multiple', { count });
  }
  return t('context.deleteMessage.generic');
});

const {
  isDeleteConfirmOpen,
  isDeleting,
  requestDelete,
  confirmDelete,
} = useDeleteConfirm();

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
  return actions.resolveItemPath(item);
};

const runCut = () => actions.runCut();
const runCopy = () => actions.runCopy();
const runPasteIntoDirectory = async () => {
  if (!actions.canPaste.value) return;
  const destination = resolveItemPath(targetItem.value);
  await actions.runPasteToDestination(destination);
};

const runPasteIntoCurrent = async () => {
  if (!actions.canPaste.value) return;
  await actions.runPasteIntoCurrent();
};

const runCreateFile = async () => {
  await fileStore.createFile();
};

const runCreateFolder = async () => {
  await fileStore.createFolder();
};

const runRename = () => actions.runRename();

// requestDelete and confirmDelete are provided by useDeleteConfirm()

const runGetInfo = () => {
  if (!primaryItem.value) return;
  // Open right-side info panel with selected item
  infoPanel.open(primaryItem.value);
};

// Favorites support
const selectedDirectoryPath = computed(() => {
  if (contextKind.value !== 'directory') return null;
  const item = targetItem.value;
  if (!item || item.kind !== 'directory') return null;
  return normalizePath(actions.resolveItemPath(item));
});

const isFavoriteDirectory = computed(() => {
  const path = selectedDirectoryPath.value;
  if (!path) return false;
  return favoritesStore.isFavorite(path);
});

const currentDirectoryPath = computed(() => normalizePath(fileStore.getCurrentPath || ''));
const isFavoriteCurrentDirectory = computed(() => {
  const path = currentDirectoryPath.value;
  if (!path) return false;
  return favoritesStore.isFavorite(path);
});

const runToggleFavoriteForDirectory = async () => {
  const path = selectedDirectoryPath.value;
  if (!path || isMutatingFavorite.value) return;
  isMutatingFavorite.value = true;
  try {
    if (isFavoriteDirectory.value) {
      await favoritesStore.removeFavorite(path);
    } else {
      const favorite = await favoritesStore.addFavorite({ path });
      if (favorite) {
        openEditorForFavorite(favorite);
      }
    }
  } finally {
    isMutatingFavorite.value = false;
  }
};

const runToggleFavoriteForCurrent = async () => {
  const path = currentDirectoryPath.value;
  if (!path || isMutatingFavorite.value) return;
  isMutatingFavorite.value = true;
  try {
    if (isFavoriteCurrentDirectory.value) {
      await favoritesStore.removeFavorite(path);
    } else {
      const favorite = await favoritesStore.addFavorite({ path });
      if (favorite) {
        openEditorForFavorite(favorite);
      }
    }
  } finally {
    isMutatingFavorite.value = false;
  }
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
        mk('get-info', t('context.getInfo'), InfoRound, runGetInfo, {
          disabled: !primaryItem.value,
        }),
      ],
      [
        mk(
          'fav-current',
          isFavoriteCurrentDirectory.value ? t('context.removeFromFavorites') : t('context.addToFavorites'),
          isFavoriteCurrentDirectory.value ? StarSolid : StarOutline,
          runToggleFavoriteForCurrent,
          { disabled: !currentDirectoryPath.value || isMutatingFavorite.value },
        ),
      ],
      [
        mk('new-folder', t('context.newFolder'), CreateNewFolderRound, runCreateFolder),
        mk('new-file', t('context.newFile'), InsertDriveFileRound, runCreateFile),
      ],
      [
        mk('paste', t('context.paste'), ContentPasteRound, runPasteIntoCurrent, {
          disabled: !actions.canPaste.value,
          shortcut: `${modKeyLabel}V`,
        }),
      ],
    ];
  }

  const sections = [];
  sections.push([
    mk('get-info', t('context.getInfo'), InfoRound, runGetInfo, { disabled: !primaryItem.value }),
  ]);

  const clipboardSection = [
    mk('cut', t('context.cut'), ContentCutRound, runCut, { disabled: !actions.canCut.value, shortcut: `${modKeyLabel}X` }),
    mk('copy', t('context.copy'), ContentCopyRound, runCopy, { disabled: !actions.canCopy.value, shortcut: `${modKeyLabel}C` }),
  ];
  if (contextKind.value === 'directory') {
    clipboardSection.push(
      mk('paste', t('context.paste'), ContentPasteRound, runPasteIntoDirectory, { disabled: !actions.canPaste.value, shortcut: `${modKeyLabel}V` }),
    );
  }
  sections.push(clipboardSection);

  sections.push([
    mk('rename', t('context.rename'), DriveFileRenameOutlineRound, runRename, { disabled: !canRename.value }),
  ]);

  if (contextKind.value === 'directory') {
    sections.push([
      mk(
        'fav',
        isFavoriteDirectory.value ? t('context.removeFromFavorites') : t('context.addToFavorites'),
        isFavoriteDirectory.value ? StarSolid : StarOutline,
        runToggleFavoriteForDirectory,
        { disabled: !selectedDirectoryPath.value || isMutatingFavorite.value },
      ),
    ]);
  }

  sections.push([
  mk('delete', t('context.delete'), DeleteRound, requestDelete, { disabled: !hasSelection.value, danger: true, shortcut: deleteKeyLabel }),
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
          <span v-if="action.disabled" class="sr-only">{{ $t('common.disabled') }}</span>
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
        {{ $t('common.cancel') }}
      </button>
      <button
        type="button"
        class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 active:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-500 dark:hover:bg-red-400"
        @click="confirmDelete"
        :disabled="isDeleting"
      >
        <span v-if="isDeleting">{{ $t('common.deleting') }}</span>
        <span v-else>{{ $t('common.delete') }}</span>
      </button>
    </div>
  </ModalDialog>
</template>

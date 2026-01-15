import { computed } from 'vue';
import { useMagicKeys, whenever } from '@vueuse/core';
import { useFileActions } from '@/composables/fileActions';
import { useDeleteConfirm } from '@/composables/useDeleteConfirm';
import { useSettingsStore } from '@/stores/settings';
import { useSpotlightStore } from '@/stores/spotlight';

function useModCombo(keys, key) {
  return computed(() => keys[`Ctrl+${key}`]?.value || keys[`Meta+${key}`]?.value);
}

function useAltCombo(keys, key) {
  return computed(() => keys[`Alt+${key}`]?.value || keys[`Alt+Digit${key}`]?.value);
}

export function useKeyboardShortcuts(options = {}) {
  const {
    clipboard = true,
    spotlight = true,
    view = true,
    rename = true,
    ignoreWhenEditable = true,
  } = options;

  const actions = useFileActions();
  const settings = useSettingsStore();
  const spotlightStore = useSpotlightStore();
  const { requestDelete } = useDeleteConfirm();
  const keys = useMagicKeys();

  const shouldIgnore = () => {
    if (!ignoreWhenEditable) return false;
    const active = document.activeElement;
    return actions.isEditableElement ? actions.isEditableElement(active) : false;
  };

  if (clipboard) {
    const cutPressed = useModCombo(keys, 'X');
    whenever(cutPressed, () => {
      if (shouldIgnore()) return;
      if (!actions.canCut.value) return;
      actions.runCut();
    });

    const copyPressed = useModCombo(keys, 'C');
    whenever(copyPressed, () => {
      if (shouldIgnore()) return;
      if (!actions.canCopy.value) return;
      actions.runCopy();
    });

    const pastePressed = useModCombo(keys, 'V');
    whenever(pastePressed, async () => {
      if (shouldIgnore()) return;
      if (!actions.canPaste.value) return;
      try {
        await actions.runPasteIntoCurrent();
      } catch (err) {
        console.error('Paste failed', err);
      }
    });

    const deletePressed = computed(() => keys.delete?.value || keys.backspace?.value);
    whenever(deletePressed, () => {
      if (shouldIgnore()) return;
      requestDelete();
    });
  }

  if (spotlight) {
    const openSpotlightPressed = useModCombo(keys, 'K');
    whenever(openSpotlightPressed, () => {
      if (shouldIgnore()) return;
      if (spotlightStore.isOpen) return;
      spotlightStore.open();
    });

    const closeSpotlightPressed = computed(() => keys.escape?.value && spotlightStore.isOpen);
    whenever(closeSpotlightPressed, () => {
      spotlightStore.close();
    });
  }

  if (view) {
    const gridViewPressed = useAltCombo(keys, '1');
    whenever(gridViewPressed, () => {
      if (shouldIgnore()) return;
      settings.gridView();
    });

    const listViewPressed = useAltCombo(keys, '2');
    whenever(listViewPressed, () => {
      if (shouldIgnore()) return;
      settings.listView();
    });

    const tabViewPressed = useAltCombo(keys, '3');
    whenever(tabViewPressed, () => {
      if (shouldIgnore()) return;
      settings.tabView();
    });

    const photosViewPressed = useAltCombo(keys, '4');
    whenever(photosViewPressed, () => {
      if (shouldIgnore()) return;
      settings.photosView();
    });
  }

  if (rename) {
    const renamePressed = computed(() => keys.f2?.value);
    whenever(renamePressed, () => {
      if (shouldIgnore()) return;
      if (!actions.canRename.value) return;
      actions.runRename();
    });
  }
}

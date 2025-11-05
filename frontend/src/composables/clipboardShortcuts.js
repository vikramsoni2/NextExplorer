import { useMagicKeys, whenever } from '@vueuse/core'
import { computed } from 'vue'
import { useFileActions } from '@/composables/fileActions'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm';

export function useClipboardShortcuts() {
  const actions = useFileActions();
  const keys = useMagicKeys();

  // Small helper: ignore when focus is inside editable elements (inputs, textareas, contenteditable)
  const shouldIgnore = () => {
    const active = document.activeElement;
    return actions.isEditableElement ? actions.isEditableElement(active) : false;
  }

  const cutPressed = computed(() => (keys['Ctrl+X']?.value || keys['Meta+X']?.value));
  whenever(cutPressed, () => {
    if (shouldIgnore()) return;
    if (!actions.canCut.value) return;
    actions.runCut();
  });

  const copyPressed = computed(() => (keys['Ctrl+C']?.value || keys['Meta+C']?.value));
  whenever(copyPressed, () => {
    if (shouldIgnore()) return;
    if (!actions.canCopy.value) return;
    actions.runCopy();
  });

  const pastePressed = computed(() => (keys['Ctrl+V']?.value || keys['Meta+V']?.value));
  whenever(pastePressed, async () => {
    if (shouldIgnore()) return;
    if (!actions.canPaste.value) return;
    try {
      await actions.runPasteIntoCurrent();
    } catch (err) {
      // Surface errors to console only; UI can handle feedback separately
      console.error('Paste failed', err);
    }
  });

  // Delete / Backspace -> delete selected items (when focus not in editable)
  const { requestDelete } = useDeleteConfirm();

  const deletePressed = computed(() => (keys.delete?.value || keys.backspace?.value));
  whenever(deletePressed, async () => {
    if (shouldIgnore()) return;
    // Open the centralized delete confirmation dialog instead of deleting immediately
    requestDelete();
  });
}

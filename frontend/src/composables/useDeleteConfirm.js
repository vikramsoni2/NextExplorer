import { ref } from 'vue'
import { useFileActions } from '@/composables/fileActions'

// Singleton instance so multiple callers share the same modal state
let instance = null;

export function useDeleteConfirm() {
  if (instance) return instance;

  const actions = useFileActions();

  const isDeleteConfirmOpen = ref(false);
  const isDeleting = ref(false);

  const openDeleteConfirm = () => {
    if (!actions.hasSelection.value) return;
    isDeleteConfirmOpen.value = true;
  };

  const closeDeleteConfirm = () => {
    isDeleteConfirmOpen.value = false;
  };

  const requestDelete = () => {
    openDeleteConfirm();
  };

  const confirmDelete = async () => {
    if (!actions.hasSelection.value || isDeleting.value) return;
    isDeleting.value = true;
    try {
      await actions.deleteNow();
      isDeleteConfirmOpen.value = false;
    } catch (err) {
      console.error('Delete operation failed', err);
    } finally {
      isDeleting.value = false;
    }
  };

  instance = {
    isDeleteConfirmOpen,
    isDeleting,
    openDeleteConfirm,
    closeDeleteConfirm,
    requestDelete,
    confirmDelete,
  };

  return instance;
}

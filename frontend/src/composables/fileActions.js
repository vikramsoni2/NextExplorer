import { computed } from 'vue';
import { useFileStore } from '@/stores/fileStore';
import { normalizePath } from '@/api';

function isEditableElement(el) {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (el.isContentEditable) return true;
  return false;
}

function resolveItemPath(item) {
  if (!item || !item.name) return '';
  const parent = normalizePath(item.path || '');
  const combined = parent ? `${parent}/${item.name}` : item.name;
  return normalizePath(combined);
}

export function useFileActions() {
  const fileStore = useFileStore();

  const selectedItems = computed(() => fileStore.selectedItems);
  const hasSelection = computed(() => fileStore.hasSelection);
  const isSingleItemSelected = computed(() => selectedItems.value.length === 1);
  const primaryItem = computed(() => selectedItems.value[0] ?? null);

  const locationCanWrite = computed(
    () => fileStore.currentPathData?.canWrite ?? true,
  );
  const locationCanUpload = computed(
    () => fileStore.currentPathData?.canUpload ?? true,
  );
  const locationCanDelete = computed(
    () => fileStore.currentPathData?.canDelete ?? true,
  );

  const canCut = computed(
    () =>
      hasSelection.value && locationCanWrite.value && locationCanDelete.value,
  );
  const canCopy = computed(() => hasSelection.value);
  const canPaste = computed(
    () =>
      fileStore.hasClipboardItems &&
      (locationCanWrite.value || locationCanUpload.value),
  );
  const canDelete = computed(
    () => hasSelection.value && locationCanDelete.value,
  );
  const canRename = computed(
    () =>
      isSingleItemSelected.value &&
      primaryItem.value?.kind !== 'volume' &&
      locationCanWrite.value,
  );

  const isCutActive = computed(() => fileStore.cutItems.length > 0);
  const isCopyActive = computed(() => fileStore.copiedItems.length > 0);

  const runCut = () => {
    if (canCut.value) fileStore.cut();
  };
  const runCopy = () => {
    if (canCopy.value) fileStore.copy();
  };
  const runPasteToDestination = async (destinationPath) => {
    if (!canPaste.value) return;
    const dest = typeof destinationPath === 'string' ? destinationPath : '';
    await fileStore.paste(dest || undefined);
  };
  const runPasteIntoCurrent = async () => runPasteToDestination('');

  const runRename = () => {
    if (!canRename.value || !primaryItem.value) return;
    fileStore.beginRename(primaryItem.value);
  };

  const deleteNow = async () => {
    if (!canDelete.value) return;
    await fileStore.del();
  };

  const runDownload = () => {
    if (!hasSelection.value) return;

    const paths = selectedItems.value
      .map((item) => {
        const parent = normalizePath(item.path || '');
        const combined = parent ? `${parent}/${item.name}` : item.name;
        return normalizePath(combined);
      })
      .filter(Boolean);

    if (!paths.length) return;

    const currentPath = normalizePath(fileStore.getCurrentPath || '');

    // Create a hidden form to submit the download request
    // This triggers the browser's native download with progress bar
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/download';
    form.style.display = 'none';

    // Add each path as a separate 'paths' field (form arrays)
    paths.forEach((path) => {
      const pathInput = document.createElement('input');
      pathInput.type = 'hidden';
      pathInput.name = 'paths';
      pathInput.value = path;
      form.appendChild(pathInput);
    });

    // Add basePath
    const basePathInput = document.createElement('input');
    basePathInput.type = 'hidden';
    basePathInput.name = 'basePath';
    basePathInput.value = currentPath;
    form.appendChild(basePathInput);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  return {
    // state
    selectedItems,
    primaryItem,
    isSingleItemSelected,
    // guards
    hasSelection,
    locationCanWrite,
    locationCanUpload,
    locationCanDelete,
    canCut,
    canCopy,
    canPaste,
    canDelete,
    canRename,
    isCutActive,
    isCopyActive,
    // helpers
    resolveItemPath,
    isEditableElement,
    // actions
    runCut,
    runCopy,
    runPasteToDestination,
    runPasteIntoCurrent,
    runRename,
    deleteNow,
    runDownload,
  };
}

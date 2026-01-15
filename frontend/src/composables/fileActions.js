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

  const locationCanWrite = computed(() => fileStore.currentPathData?.canWrite ?? true);
  const locationCanUpload = computed(() => fileStore.currentPathData?.canUpload ?? true);
  const locationCanDelete = computed(() => fileStore.currentPathData?.canDelete ?? true);

  const isZipSelected = computed(() => {
    if (!isSingleItemSelected.value || !primaryItem.value) return false;
    const kind = String(primaryItem.value.kind || '').toLowerCase();
    if (kind === 'zip') return true;
    const name = String(primaryItem.value.name || '').toLowerCase();
    return name.endsWith('.zip');
  });

  const selectionHasUniformParent = computed(() => {
    if (!hasSelection.value) return false;
    const parents = new Set(
      selectedItems.value.map((item) => normalizePath(item?.path || '')).filter(Boolean)
    );
    if (parents.size === 1) return true;
    // Special case: items in the root of a volume have empty parent path ("")
    const rawParents = new Set(selectedItems.value.map((item) => normalizePath(item?.path || '')));
    return rawParents.size === 1;
  });

  const canCut = computed(
    () => hasSelection.value && locationCanWrite.value && locationCanDelete.value
  );
  const canCopy = computed(() => hasSelection.value);
  const canPaste = computed(
    () => fileStore.hasClipboardItems && (locationCanWrite.value || locationCanUpload.value)
  );
  const canDelete = computed(() => hasSelection.value && locationCanDelete.value);
  const canRename = computed(
    () =>
      isSingleItemSelected.value && primaryItem.value?.kind !== 'volume' && locationCanWrite.value
  );
  const canExtractZip = computed(
    () => isZipSelected.value && locationCanWrite.value && primaryItem.value?.kind !== 'volume'
  );
  const canCompressToZip = computed(
    () =>
      hasSelection.value &&
      locationCanWrite.value &&
      selectionHasUniformParent.value &&
      selectedItems.value.every((item) => item?.kind !== 'volume')
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

  const runExtractZip = async () => {
    if (!canExtractZip.value || !primaryItem.value) return;
    const zipPath = resolveItemPath(primaryItem.value);
    if (!zipPath) return;
    await fileStore.extractZipArchive(zipPath);
  };

  const runCompressToZip = async () => {
    if (!canCompressToZip.value) return;
    await fileStore.compressSelectionToZip();
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
    canExtractZip,
    canCompressToZip,
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
    runExtractZip,
    runCompressToZip,
    deleteNow,
    runDownload,
  };
}

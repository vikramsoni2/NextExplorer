import { normalizePath } from '@/api';
import { useFileStore } from '@/stores/fileStore';

const getItemKey = (item) => {
  if (!item || !item.name) return '';
  const parent = normalizePath(item.path || '');
  return `${parent}::${item.name}`;
};

export function useSelection() {
  const fileStore = useFileStore();

  const findInCurrentItems = (item) => {
    const key = getItemKey(item);
    return (
      fileStore.getCurrentPathItems.find(
        (candidate) => getItemKey(candidate) === key,
      ) || item
    );
  };

  const isSelected = (item) =>
    fileStore.selectedItems.some(
      (selected) => getItemKey(selected) === getItemKey(item),
    );

  const toggleSelection = (item) => {
    const key = getItemKey(item);
    const index = fileStore.selectedItems.findIndex(
      (selected) => getItemKey(selected) === key,
    );

    if (index === -1) {
      const resolved = findInCurrentItems(item);
      fileStore.selectedItems = [...fileStore.selectedItems, resolved];
    } else {
      const nextSelection = [...fileStore.selectedItems];
      nextSelection.splice(index, 1);
      fileStore.selectedItems = nextSelection;
    }
  };

  const selectRange = (item) => {
    const currentItems = fileStore.getCurrentPathItems;
    const targetKey = getItemKey(item);
    const endIndex = currentItems.findIndex(
      (entry) => getItemKey(entry) === targetKey,
    );

    if (endIndex === -1) {
      return;
    }

    const anchor =
      fileStore.selectedItems[fileStore.selectedItems.length - 1] || item;
    const anchorKey = getItemKey(anchor);
    const startIndex = currentItems.findIndex(
      (entry) => getItemKey(entry) === anchorKey,
    );

    if (startIndex === -1) {
      fileStore.selectedItems = [currentItems[endIndex]];
      return;
    }

    const [start, end] =
      startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
    fileStore.selectedItems = currentItems.slice(start, end + 1);
  };

  const clearSelection = () => {
    fileStore.selectedItems = [];
  };

  const handleSelection = (item, event) => {
    if (event?.ctrlKey || event?.metaKey) {
      toggleSelection(item);
    } else if (event?.shiftKey && fileStore.selectedItems.length > 0) {
      selectRange(item);
    } else {
      clearSelection();
      toggleSelection(item);
    }
  };

  return {
    isSelected,
    handleSelection,
    clearSelection,
  };
}

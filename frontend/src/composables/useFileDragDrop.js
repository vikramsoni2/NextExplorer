import { ref } from 'vue';
import { useFileStore } from '@/stores/fileStore';
import { moveItems, normalizePath } from '@/api';
import { useInputMode } from '@/composables/useInputMode';

/**
 * Composable for handling file and folder drag and drop operations.
 * Desktop only - will not work on touch devices.
 */
export function useFileDragDrop() {
  const fileStore = useFileStore();
  const { isTouchDevice } = useInputMode();
  const isDraggingOver = ref(false);
  const dragOverTarget = ref(null);

  const serializeItems = (items) =>
    (Array.isArray(items) ? items : [])
      .filter((item) => item && item.name && item.kind !== 'volume')
      .map((item) => ({
        name: item.name,
        path: normalizePath(item.path || ''),
        kind: item.kind,
      }));

  const resolveFolderDestination = (targetFolder) => {
    if (!targetFolder || !targetFolder.name) {
      return normalizePath(fileStore.currentPath || '');
    }

    const parent = normalizePath(targetFolder.path || '');
    const combined = parent ? `${parent}/${targetFolder.name}` : targetFolder.name;
    return normalizePath(combined);
  };

  /**
   * Check if drag and drop should be enabled (desktop only)
   */
  const canDragDrop = () => {
    return !isTouchDevice.value;
  };

  /**
   * Handle drag start on a file/folder item
   * @param {DragEvent} event - The drag event
   * @param {Object} item - The item being dragged
   */
  const handleDragStart = (event, item) => {
    if (!canDragDrop()) {
      event.preventDefault();
      return;
    }

    // Determine which items to drag
    // If the item is selected, drag all selected items
    // Otherwise, drag just this item
    const selectedItems = fileStore.selectedItems || [];
    const isSelected = selectedItems.some(
      (selected) => selected.name === item.name && selected.path === item.path
    );

    const itemsToDrag = isSelected && selectedItems.length > 0 ? selectedItems : [item];

    // Store the items being dragged in dataTransfer
    const dragData = JSON.stringify(itemsToDrag);
    event.dataTransfer.setData('application/json', dragData);
    event.dataTransfer.effectAllowed = 'move';

    // Create custom drag image with badge
    createDragImage(event, itemsToDrag, item);
  };

  /**
  /**
   * Create a custom drag image with a badge showing the number of items
   * @param {DragEvent} event - The drag event
   * @param {Array} items - Items being dragged
   * @param {Object} primaryItem - The main item being dragged (under cursor)
   */
  const createDragImage = (event, items, primaryItem) => {
    const count = items.length;
    const dragImage = document.createElement('div');
    dragImage.className = 'file-drag-image';

    const stack = document.createElement('div');
    stack.className = 'file-drag-stack';
    const stackDepth = Math.min(count, 3);

    let iconNode = null;
    const sourceEl = event.currentTarget;
    if (sourceEl) {
      const foundIcon = sourceEl.querySelector('svg') || sourceEl.querySelector('.bg-contain');
      if (foundIcon) {
        iconNode = foundIcon.cloneNode(true);
        iconNode.style.width = '24px';
        iconNode.style.height = '24px';
        iconNode.classList.remove('w-full', 'h-full', 'w-16', 'h-16', 'w-6', 'h-6');
      }
    }

    for (let i = 0; i < stackDepth; i++) {
      const card = document.createElement('div');
      card.className = 'file-drag-card';

      const offset = (stackDepth - 1 - i) * 8;
      card.style.marginLeft = `${offset}px`;
      card.style.marginTop = `${offset}px`;
      card.style.zIndex = i + 1;

      const iconContainer = document.createElement('div');
      iconContainer.className = 'flex shrink-0 items-center justify-center w-6 h-6';
      if (iconNode) {
        iconContainer.appendChild(iconNode.cloneNode(true));
      } else {
        // Fallback placeholder
        iconContainer.innerHTML = '<div class="w-4 h-4 bg-gray-400 rounded"></div>';
      }
      card.appendChild(iconContainer);
      const label = document.createElement('span');
      label.className = 'truncate text-sm font-medium';
      if (i === stackDepth - 1) {
        label.textContent = primaryItem.name;
      } else {
        label.textContent = items[i] && items[i].name ? items[i].name : primaryItem.name;
      }
      card.appendChild(label);

      stack.appendChild(card);
    }

    dragImage.appendChild(stack);
    const badge = document.createElement('div');
    badge.className = 'file-drag-badge';
    badge.textContent = count.toString();

    dragImage.appendChild(badge);
    document.body.appendChild(dragImage);

    const xOffset = -10;
    const yOffset = 10;

    event.dataTransfer.setDragImage(dragImage, xOffset, yOffset);

    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 100);
  };

  /**
   * Handle drag over a folder (potential drop target)
   * @param {DragEvent} event - The drag event
   * @param {Object} targetFolder - The folder being hovered over
   */
  const handleDragOver = (event, targetFolder) => {
    if (!canDragDrop()) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    // Store the target folder for drag leave/drop handling
    dragOverTarget.value = targetFolder;
    isDraggingOver.value = true;
  };

  /**
   * Handle drag leave a folder
   * @param {DragEvent} event - The drag event
   * @param {Object} targetFolder - The folder being left
   */
  const handleDragLeave = (event, targetFolder) => {
    if (!canDragDrop()) return;

    // Only clear if we're actually leaving the folder (not just entering a child)
    // Check if the related target is still within the folder
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;

    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      if (dragOverTarget.value === targetFolder) {
        dragOverTarget.value = null;
        isDraggingOver.value = false;
      }
    }
  };

  /**
   * Handle drop on a folder
   * @param {DragEvent} event - The drag event
   * @param {Object} targetFolder - The folder to drop into
   */
  const handleDrop = async (event, targetFolder) => {
    if (!canDragDrop()) return;

    event.preventDefault();
    event.stopPropagation();

    isDraggingOver.value = false;
    dragOverTarget.value = null;

    // Get the dragged items from dataTransfer
    const dragData = event.dataTransfer.getData('application/json');
    if (!dragData) return;

    const draggedItems = JSON.parse(dragData);
    if (!Array.isArray(draggedItems) || draggedItems.length === 0) return;

    // Get the destination path (target folder's full relative path)
    const destination = resolveFolderDestination(targetFolder);

    // Validate: prevent dropping a folder into itself
    const isSelfDrop = draggedItems.some(
      (item) => item.name === targetFolder.name && item.path === targetFolder.path
    );

    if (isSelfDrop) {
      console.warn('Cannot drop a folder into itself');
      return;
    }

    // Validate: prevent dropping a folder into its own descendants
    const isDescendantDrop = draggedItems.some((item) => {
      if (item.kind !== 'directory') return false;

      const itemPath = normalizePath(item.path ? `${item.path}/${item.name}` : item.name);
      return Boolean(itemPath) && destination.startsWith(`${itemPath}/`);
    });

    if (isDescendantDrop) {
      console.warn('Cannot drop a folder into its own descendant');
      return;
    }

    try {
      // Prepare payload for moveItems API
      const movePayload = serializeItems(draggedItems);
      if (movePayload.length === 0) return;

      // Call the moveItems API
      await moveItems(movePayload, destination);

      // Refresh the current path to show the changes
      await fileStore.fetchPathItems(fileStore.currentPath);
    } catch (error) {
      console.error('Failed to move items:', error);
    }
  };

  /**
   * Check if a folder is currently being dragged over
   * @param {Object} folder - The folder to check
   * @returns {boolean} True if this folder is the drag target
   */
  const isDragTarget = (folder) => {
    if (!dragOverTarget.value) return false;
    return dragOverTarget.value.name === folder.name && dragOverTarget.value.path === folder.path;
  };

  return {
    isDraggingOver,
    canDragDrop,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    isDragTarget,
  };
}

import { useRouter, useRoute } from 'vue-router';
import { ref } from 'vue';
import { useFileStore } from '@/stores/fileStore';

export function useSelection() {

  const fileStore = useFileStore();

  const isSelected = (item) => fileStore.selectedItems.some(i => i.name === item.name );

  const toggleSelection = (item) => {
    const index = fileStore.selectedItems.findIndex(i => i.name === item.name);
    if (index === -1) {
      fileStore.selectedItems.push(item);
    } else {
      fileStore.selectedItems.splice(index, 1);
    }
  };

  // const selectRange = (item) => {
  //   const startIndex = fileStore.getCurrentPathItems.findIndex(i => i.name === fileStore.selectedItems[0].name);
  //   const endIndex = fileStore.getCurrentPathItems.findIndex(i => i.name === item.name);
  //   const [start, end] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
  //   fileStore.selectedItems = fileStore.getCurrentPathItems.slice(start, end + 1);
  // };

  const selectRange = (item) => {
    const currentItems = fileStore.getCurrentPathItems;
    const selectedItems = fileStore.selectedItems;
  
    // Find the index of the clicked item
    const endIndex = currentItems.findIndex(i => i.name === item.name);
  
    // Find the highest index of currently selected items
    const selectedIndices = selectedItems.map(i => currentItems.findIndex(ci => ci.name === i.name));
    const highestSelectedIndex = Math.max(...selectedIndices);
  
    // Determine the start index
    const startIndex = endIndex < highestSelectedIndex ? highestSelectedIndex : selectedIndices[0];
  
    // Determine the range
    const [start, end] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
  
    // Update the selected items
    fileStore.selectedItems = currentItems.slice(start, end + 1);
  };
  

  const clearSelection = () => {
    fileStore.selectedItems = [];
  };

  const handleSelection = (item, event) => {
    console.log(item)
    if (event.ctrlKey || event.metaKey) {
      // Control/Command + Click
      toggleSelection(item);
    } else if (event.shiftKey && fileStore.selectedItems.length > 0) {
      // Shift + Click
      selectRange(item);
    } else {
      // Single Click
      clearSelection();
      toggleSelection(item);
    }
  };


  return {
    isSelected,
    handleSelection,
    clearSelection,
  }
}

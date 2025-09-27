<script setup>
import { computed } from 'vue';
import { ArrowDownTrayIcon, TrashIcon } from '@heroicons/vue/24/outline';
import { useFileStore } from '@/stores/fileStore';
import { getDownloadUrl, normalizePath } from '@/api';

const fileStore = useFileStore();

const selectedItems = computed(() => fileStore.selectedItems);
const selectedItem = computed(() => selectedItems.value[0] ?? null);
const hasSelection = computed(() => selectedItems.value.length > 0);

const isSingleFileSelected = computed(() => {
  if (!selectedItem.value) return false;
  return selectedItems.value.length === 1 && selectedItem.value.kind !== 'directory';
});

const selectedPath = computed(() => {
  if (!selectedItem.value) return null;
  const parent = normalizePath(selectedItem.value.path || '');
  const combined = parent ? `${parent}/${selectedItem.value.name}` : selectedItem.value.name;
  return normalizePath(combined);
});

const downloadHref = computed(() => {
  if (!isSingleFileSelected.value || !selectedPath.value) return null;
  return getDownloadUrl(selectedPath.value);
});

const handleDownload = () => {
  if (!downloadHref.value) return;
  const anchor = document.createElement('a');
  anchor.href = downloadHref.value;
  anchor.download = selectedItem.value.name;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

const handleDelete = async () => {
  if (!selectedItems.value.length) return;
  try {
    await fileStore.del();
  } catch (error) {
    console.error('Delete operation failed', error);
  }
};
</script>

<template>
  <div class="flex gap-1 items-center">
    <button
      type="button"
      @click="handleDownload"
      :disabled="!isSingleFileSelected"
      class="p-[6px] rounded-md transition-colors
        hover:bg-[rgb(239,239,240)] active:bg-zinc-200
        dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      :class="{ 'opacity-50 cursor-not-allowed': !isSingleFileSelected }"
    >
      <ArrowDownTrayIcon class="w-6" />
    </button>
    <button
      type="button"
      @click="handleDelete"
      :disabled="!hasSelection"
      class="p-[6px] rounded-md transition-colors
        hover:bg-[rgb(239,239,240)] active:bg-zinc-200
        dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      :class="{ 'opacity-50 cursor-not-allowed': !hasSelection }"
    >
      <TrashIcon class="w-6" />
    </button>
  </div>
</template>

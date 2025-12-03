<script setup>
import { computed, ref } from 'vue';
import { ArrowDownTrayIcon, TrashIcon } from '@heroicons/vue/24/outline';
import { useFileStore } from '@/stores/fileStore';
import { useFileActions } from '@/composables/fileActions';
import { normalizePath } from '@/api';
import ModalDialog from '@/components/ModalDialog.vue';
import { Rename20Regular } from '@vicons/fluent';

const fileStore = useFileStore();
const actions = useFileActions();

const selectedItems = actions.selectedItems;
const selectedItem = actions.primaryItem;
const hasSelection = actions.hasSelection;
const isSingleItemSelected = actions.isSingleItemSelected;
const isSingleFileSelected = computed(() => isSingleItemSelected.value && selectedItem.value?.kind !== 'directory');
const canRename = actions.canRename;
const currentPath = computed(() => normalizePath(fileStore.getCurrentPath || ''));
const isDeleteConfirmOpen = ref(false);
const isDeleting = ref(false);

const deleteDialogTitle = computed(() => {
  const count = selectedItems.value.length;
  if (count === 1) {
    return 'Delete Item';
  }
  if (count > 1) {
    return `Delete ${count} Items`;
  }
  return 'Delete Items';
});

const deleteDialogMessage = computed(() => {
  const count = selectedItems.value.length;
  if (count === 1 && selectedItem.value) {
    return `Are you sure you want to delete "${selectedItem.value.name}"? This action cannot be undone.`;
  }
  if (count > 1) {
    return `Are you sure you want to delete these ${count} items? This action cannot be undone.`;
  }
  return 'No items selected.';
});

const getResolvedPaths = () => selectedItems.value
  .map((item) => {
    const parent = normalizePath(item.path || '');
    const combined = parent ? `${parent}/${item.name}` : item.name;
    return normalizePath(combined);
  })
  .filter(Boolean);

const handleDownload = async () => {
  if (!hasSelection.value) return;

  const paths = getResolvedPaths();
  if (!paths.length) return;

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
  basePathInput.value = currentPath.value;
  form.appendChild(basePathInput);

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};

const handleDelete = () => {
  if (!selectedItems.value.length) return;
  isDeleteConfirmOpen.value = true;
};

const confirmDelete = async () => {
  if (!selectedItems.value.length || isDeleting.value) {
    return;
  }

  isDeleting.value = true;
  try {
    await actions.deleteNow();
    isDeleteConfirmOpen.value = false;
  } catch (error) {
    console.error('Delete operation failed', error);
  } finally {
    isDeleting.value = false;
  }
};

const handleRename = () => {
  if (!canRename.value) return;
  const target = selectedItems.value[0];
  if (!target) return;
  fileStore.beginRename(target);
};
</script>

<template>
  <div class="flex gap-1 items-center">
    <!-- <button
      type="button"
      @click="handleRename"
      :disabled="!canRename"
      class="p-[6px] rounded-md transition-colors
        hover:bg-[rgb(239,239,240)] active:bg-zinc-200
        dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      :class="{ 'opacity-50 cursor-not-allowed': !canRename }"
      title="Rename"
    >
      <Rename20Regular class="w-6" />
    </button> -->
    <button
      type="button"
      @click="handleDownload"
      :disabled="!hasSelection"
      class="p-[6px] rounded-md transition-colors
        hover:bg-[rgb(239,239,240)] active:bg-zinc-200
        dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      :class="{ 'opacity-50 cursor-default pointer-events-none': !hasSelection }"
      :title="$t('actions.download')"
    >
      <ArrowDownTrayIcon class="w-6" />
    </button>
    <!-- <button
      type="button"
      @click="handleDelete"
      :disabled="!hasSelection"
      class="p-[6px] rounded-md transition-colors
        hover:bg-[rgb(239,239,240)] active:bg-zinc-200
        dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      :class="{ 'opacity-50 cursor-not-allowed': !hasSelection }"
      title="Delete"
    >
      <TrashIcon class="w-6" />
    </button> -->
  </div>
  <!-- <ModalDialog v-model="isDeleteConfirmOpen">
    <template #title>{{ deleteDialogTitle }}</template>
    <p class="mb-6 text-base text-zinc-700 dark:text-zinc-200">
      {{ deleteDialogMessage }}
    </p>
    <div class="flex justify-end gap-3">
      <button
        type="button"
        class="px-4 py-2 text-sm font-medium rounded-md border border-zinc-300 text-zinc-700 transition-colors hover:bg-zinc-100 active:bg-zinc-200 disabled:opacity-60 disabled:cursor-not-allowed dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
        @click="isDeleteConfirmOpen = false"
        :disabled="isDeleting"
        
      >
        Cancel
      </button>
      <button
        type="button"
        class="px-4 py-2 text-sm font-medium text-white rounded-md bg-red-600 transition-colors hover:bg-red-500 active:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-red-500 dark:hover:bg-red-400"
        @click="confirmDelete"
        :disabled="isDeleting"
      >
        <span v-if="isDeleting">Deleting...</span>
        <span v-else>Delete</span>
      </button>
    </div>
  </ModalDialog> -->
</template>

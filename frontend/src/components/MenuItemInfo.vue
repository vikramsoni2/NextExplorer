<script setup>
import { ArrowDownTrayIcon } from '@heroicons/vue/24/outline';
import { useFileActions } from '@/composables/fileActions';

const actions = useFileActions();

const hasSelection = actions.hasSelection;

const handleDownload = () => {
  actions.runDownload();
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
      class="p-[6px] rounded-md transition-colors hover:bg-[rgb(239,239,240)] active:bg-zinc-200 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      :class="{
        'opacity-50 cursor-default pointer-events-none': !hasSelection,
      }"
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

<script setup>
import { computed } from 'vue';
import { ClipboardPaste20Regular, Cut20Filled, Copy20Regular } from '@vicons/fluent';
import { useFileStore } from '@/stores/fileStore';

const fileStore = useFileStore();

const canCopyOrCut = computed(() => fileStore.hasSelection);
const canPaste = computed(() => fileStore.hasClipboardItems);
const isCutActive = computed(() => fileStore.cutItems.length > 0);
const isCopyActive = computed(() => fileStore.copiedItems.length > 0);

const handleCut = () => {
  if (!canCopyOrCut.value) return;
  fileStore.cut();
};

const handleCopy = () => {
  if (!canCopyOrCut.value) return;
  fileStore.copy();
};

const handlePaste = async () => {
  if (!canPaste.value) return;
  try {
    await fileStore.paste();
  } catch (error) {
    console.error('Paste operation failed', error);
  }
};
</script>

<template>
  <div class="flex gap-1 items-center">
    <button
      type="button"
      @click="handleCut"
      :disabled="!canCopyOrCut"
      class="p-[6px] rounded-md transition-colors
        hover:bg-[rgb(239,239,240)] active:bg-zinc-200
        dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      :class="{
        'opacity-50 cursor-not-allowed': !canCopyOrCut,
        'text-sky-500 dark:text-sky-300': isCutActive,
      }"
      title="Cut"
    >
      <Cut20Filled class="w-6" />
    </button>
    <button
      type="button"
      @click="handleCopy"
      :disabled="!canCopyOrCut"
      class="p-[6px] rounded-md transition-colors
        hover:bg-[rgb(239,239,240)] active:bg-zinc-200
        dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      :class="{
        'opacity-50 cursor-not-allowed': !canCopyOrCut,
        'text-sky-500 dark:text-sky-300': isCopyActive,
      }"
      title="Copy"
    >
      <Copy20Regular class="w-6" />
    </button>
    <button
      type="button"
      @click="handlePaste"
      :disabled="!canPaste"
      class="p-[6px] rounded-md transition-colors
        hover:bg-[rgb(239,239,240)] active:bg-zinc-200
        dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      :class="{ 'opacity-50 cursor-not-allowed': !canPaste }"
      title="Paste"
    >
      <ClipboardPaste20Regular class="w-6" />
    </button>
  </div>
</template>

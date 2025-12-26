<script setup>
import {
  ClipboardPaste20Regular,
  Cut20Filled,
  Copy20Regular,
} from '@vicons/fluent';
import { useFileActions } from '@/composables/fileActions';

const {
  canCut,
  canCopy,
  canPaste,
  isCutActive,
  isCopyActive,
  runCut,
  runCopy,
  runPasteIntoCurrent,
} = useFileActions();
</script>

<template>
  <div class="flex gap-1 items-center">
    <button
      type="button"
      @click="runCut"
      :disabled="!canCut"
      class="p-[6px] rounded-md transition-colors hover:bg-[rgb(239,239,240)] active:bg-zinc-200 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      :class="{
        'opacity-50 cursor-not-allowed': !canCut,
        'text-sky-500 dark:text-sky-300': isCutActive,
      }"
      :title="$t('actions.cut')"
    >
      <Cut20Filled class="w-6" />
    </button>
    <button
      type="button"
      @click="runCopy"
      :disabled="!canCopy"
      class="p-[6px] rounded-md transition-colors hover:bg-[rgb(239,239,240)] active:bg-zinc-200 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      :class="{
        'opacity-50 cursor-not-allowed': !canCopy,
        'text-sky-500 dark:text-sky-300': isCopyActive,
      }"
      :title="$t('actions.copy')"
    >
      <Copy20Regular class="w-6" />
    </button>
    <button
      type="button"
      @click="runPasteIntoCurrent"
      :disabled="!canPaste"
      class="p-[6px] rounded-md transition-colors hover:bg-[rgb(239,239,240)] active:bg-zinc-200 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      :class="{ 'opacity-50 cursor-not-allowed': !canPaste }"
      :title="$t('actions.paste')"
    >
      <ClipboardPaste20Regular class="w-6" />
    </button>
  </div>
</template>

<script setup>
import {ClipboardPaste20Regular, Cut20Filled, Copy20Regular} from '@vicons/fluent';

</script>

<template>

<div class="flex gap-1 items-center">
  <button
    class="p-[6px] rounded-md dark:hover:bg-zinc-700 dark:active:bg-zinc-600">
    <Cut20Filled class="w-6" />
  </button>
  <button
    class="p-[6px] rounded-md dark:hover:bg-zinc-700 dark:active:bg-zinc-600">
    <Copy20Regular class="w-6" />
  </button>
  <button
    class="p-[6px] rounded-md dark:hover:bg-zinc-700 dark:active:bg-zinc-600">
    <ClipboardPaste20Regular class="w-6 text-gray-500" />
  </button>
</div>

</template>

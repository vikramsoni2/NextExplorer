<!-- PdfPreview.vue -->
<template>
  <div class="relative flex h-full w-full flex-col bg-neutral-900/80">
    <div
      v-if="!previewUrl"
      class="flex flex-1 items-center justify-center text-sm text-neutral-400"
    >
      PDF preview unavailable.
    </div>

    <iframe
      v-else
      :src="viewerUrl"
      class="h-full w-full grow border-0 bg-white"
      title="PDF preview"
    />

    <a
      v-if="previewUrl"
      :href="previewUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="absolute bottom-3 right-3 rounded-md bg-neutral-800/80 px-3 py-1 text-sm font-medium text-white shadow-sm hover:bg-neutral-700"
    >
      Open in new tab
    </a>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  item: { type: Object, required: true },
  extension: { type: String, required: true },
  filePath: { type: String, required: true },
  previewUrl: { type: String, required: true },
  api: { type: Object, required: true },
});

// Add viewer params to hide chrome
const viewerUrl = computed(() => {
  if (!props.previewUrl) return null;

  const params = '#toolbar=0&navpanes=0&statusbar=0';
  const hasHash = props.previewUrl.includes('#');

  return hasHash ? props.previewUrl : `${props.previewUrl}${params}`;
});
</script>

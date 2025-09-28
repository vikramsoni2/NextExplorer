<template>
  <div class="relative flex h-full w-full flex-col bg-neutral-900/80">
    <div
      v-if="!previewSrc"
      class="flex flex-1 items-center justify-center text-sm text-neutral-400"
    >
      PDF preview unavailable.
    </div>
    <iframe
      v-else
      :key="viewerSrc"
      :src="viewerSrc"
      class="h-full w-full grow border-0 bg-white"
      title="PDF preview"
    />
    <div
      v-if="previewSrc"
      class="pointer-events-none absolute bottom-3 right-3"
    >
      <a
        :href="previewSrc"
        target="_blank"
        rel="noopener noreferrer"
        class="pointer-events-auto rounded-md bg-neutral-800/80 px-3 py-1 text-sm font-medium text-white shadow hover:bg-neutral-700"
      >
        Open in new tab
      </a>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  context: {
    type: Object,
    required: true,
  },
  previewUrl: {
    type: String,
    default: null,
  },
});

const previewSrc = computed(() => props.previewUrl || props.context?.previewUrl || null);

const viewerSrc = computed(() => {
  if (!previewSrc.value) return null;
  // Hide unnecessary chrome in most PDF viewers (best effort).
  const hasHash = previewSrc.value.includes('#');
  const suffix = '#toolbar=0&navpanes=0&statusbar=0';
  return hasHash ? previewSrc.value : `${previewSrc.value}${suffix}`;
});
</script>

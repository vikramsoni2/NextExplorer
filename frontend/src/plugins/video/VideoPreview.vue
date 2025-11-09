<template>
  <div class="flex h-full w-full items-center justify-center bg-black">
    <video
      v-if="previewUrl"
      ref="videoRef"
      class="max-h-full w-full rounded-md bg-black"
      controls
      autoplay
      playsinline
      :poster="item.thumbnail"
    >
      <source :src="previewUrl" :type="mimeType" />
      Your browser does not support the video tag.
    </video>
    <div v-else class="text-sm text-neutral-300">
      Preview unavailable.
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';

// Props - simple and direct from context
const props = defineProps({
  item: { type: Object, required: true },
  extension: { type: String, required: true },
  filePath: { type: String, required: true },
  previewUrl: { type: String, required: true },
  api: { type: Object, required: true },
});

const videoRef = ref(null);

// Compute MIME type
const mimeType = computed(() => {
  const types = {
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
    webm: 'video/webm',
    m4v: 'video/x-m4v',
    avi: 'video/x-msvideo',
  };
  return types[props.extension] || 'video/mp4';
});

// Cleanup
const cleanup = () => {
  if (!videoRef.value) return;
  try {
    videoRef.value.pause();
    videoRef.value.currentTime = 0;
  } catch (e) {
    // Ignore
  }
};

watch(() => props.previewUrl, cleanup);
onBeforeUnmount(cleanup);
</script>
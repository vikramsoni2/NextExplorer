<template>
  <div class="flex h-full w-full items-center justify-center bg-black">
    <video
      v-if="previewSrc"
      ref="videoRef"
      :key="previewSrc"
      class="max-h-full w-full rounded-md bg-black"
      controls
      autoplay
      playsinline
      :poster="posterUrl || undefined"
    >
      <source :src="previewSrc" :type="videoMimeType" />
      Your browser does not support the video tag.
    </video>
    <div v-else class="text-sm text-neutral-300">Preview unavailable.</div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { isPreviewableVideo } from '@/config/media';

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

const videoRef = ref(null);

const extension = computed(() => props.context?.extension || '');
const previewSrc = computed(() => {
  if (!isPreviewableVideo(extension.value)) {
    return null;
  }
  return props.previewUrl || props.context?.previewUrl || null;
});

const posterUrl = computed(() => props.context?.item?.thumbnail || null);

const videoMimeType = computed(() => {
  const lookup = {
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
    webm: 'video/webm',
    m4v: 'video/x-m4v',
    avi: 'video/x-msvideo',
    wmv: 'video/x-ms-wmv',
    flv: 'video/x-flv',
    mpg: 'video/mpeg',
    mpeg: 'video/mpeg',
  };
  return lookup[extension.value] || 'video/mp4';
});

const cleanupVideo = () => {
  if (videoRef.value) {
    try {
      videoRef.value.pause();
      videoRef.value.currentTime = 0;
    } catch (error) {
      // Ignore media errors during cleanup
    }
  }
};

watch(previewSrc, () => {
  cleanupVideo();
});

onBeforeUnmount(() => {
  cleanupVideo();
});
</script>

<template>
  <teleport to="body">
    <VueEasyLightbox
      v-if="previewStore.mediaUrl && previewStore.isImage"
      :visible="previewStore.isOpen && previewStore.isImage"
      :imgs="imageList"
      :index="0"
      :escDisabled="false"
      @hide="handleClose"
    />
  </teleport>

  <teleport to="body">
    <transition name="fade">
      <div
        v-if="previewStore.mediaUrl && previewStore.isVideo && previewStore.isOpen"
        class="fixed inset-0 z-[2000] flex flex-col bg-black/90 p-6 text-white"
        @click.self="handleClose"
      >
        <div class="flex items-center justify-between">
          <p class="text-lg font-semibold">{{ previewStore.currentItem?.name }}</p>
          <button type="button" class="control-btn" @click="handleClose">Close</button>
        </div>
        <div class="mt-6 flex grow items-center justify-center">
          <video
            ref="videoRef"
            :key="previewStore.mediaUrl"
            class="max-h-[80vh] w-full max-w-5xl rounded-lg bg-black"
            controls
            autoplay
            playsinline
            :poster="previewStore.posterUrl || undefined"
          >
            <source :src="previewStore.mediaUrl" :type="videoMimeType" />
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import VueEasyLightbox from 'vue-easy-lightbox';
import { usePreviewStore } from '@/stores/previewStore';

const previewStore = usePreviewStore();

const videoRef = ref(null);

const imageList = computed(() => (previewStore.mediaUrl ? [previewStore.mediaUrl] : []));

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
  return lookup[previewStore.fileExtension] || 'video/mp4';
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

const handleClose = () => {
  cleanupVideo();
  previewStore.close();
};

const handleKeydown = (event) => {
  if (event.key === 'Escape') {
    handleClose();
  }
};

watch(
  () => previewStore.isOpen,
  (isOpen) => {
    if (!isOpen) {
      cleanupVideo();
    }
  }
);

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  cleanupVideo();
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.control-btn {
  @apply rounded-md bg-white/90 px-3 py-1 text-sm font-semibold text-black transition hover:bg-white;
}
</style>

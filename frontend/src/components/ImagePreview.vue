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
        class="fixed inset-0 z-[2000] flex flex-col bg-black/90  text-white"
        @click.self="handleClose"
      >
        <div class="flex items-center justify-between z-10 pl-6 pr-4 py-1">
          <p class="text-lg font-semibold">{{ previewStore.currentItem?.name }}</p>
          <button type="button" class="text-neutral-400 hover:text-neutral-300 hover:bg-zinc-800/50 p-2 rounded-full" @click="handleClose">
            <XMarkIcon class="w-7 h-7"/>
          </button>
        </div>
        <div class="absolute flex grow h-full w-full items-center justify-center">
          <video
            ref="videoRef"
            :key="previewStore.mediaUrl"
            class=" h-full rounded-lg bg-black"
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
import { XMarkIcon } from '@heroicons/vue/20/solid';

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

</style>

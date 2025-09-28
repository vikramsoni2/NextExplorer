import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { apiBase, getPreviewUrl, normalizePath, appendAuthQuery } from '@/api';
import { isPreviewableImage, isPreviewableVideo } from '@/config/media';

const resolveExtension = (item) => {
  if (!item) return '';
  if (item.kind && item.kind !== 'directory') {
    return String(item.kind).toLowerCase();
  }
  if (typeof item.name === 'string' && item.name.includes('.')) {
    return item.name.split('.').pop().toLowerCase();
  }
  return '';
};

export const usePreviewStore = defineStore('preview', () => {
  const isOpen = ref(false);
  const currentItem = ref(null);

  const normalizedPath = computed(() => {
    if (!currentItem.value?.name) return '';
    const parent = normalizePath(currentItem.value.path || '');
    const target = parent ? `${parent}/${currentItem.value.name}` : currentItem.value.name;
    return normalizePath(target);
  });

  const mediaUrl = computed(() => {
    if (!normalizedPath.value) return null;
    return getPreviewUrl(normalizedPath.value);
  });

  const fileExtension = computed(() => resolveExtension(currentItem.value));

  const isImage = computed(() => isPreviewableImage(fileExtension.value));

  const isVideo = computed(() => isPreviewableVideo(fileExtension.value));

  const canPreview = computed(() => isImage.value || isVideo.value);

  const posterUrl = computed(() => {
    const thumbnailPath = currentItem.value?.thumbnail;
    if (!thumbnailPath) return null;
    if (/^https?:\/\//i.test(thumbnailPath)) {
      return thumbnailPath;
    }
    return appendAuthQuery(`${apiBase}${thumbnailPath}`);
  });

  const open = (item) => {
    if (!item) {
      close();
      return;
    }

    const snapshot = { ...item };
    currentItem.value = snapshot;
    if (isPreviewableImage(snapshot.kind) || isPreviewableVideo(snapshot.kind)) {
      isOpen.value = true;
      return;
    }

    const fallbackExtension = resolveExtension(snapshot);
    if (isPreviewableImage(fallbackExtension) || isPreviewableVideo(fallbackExtension)) {
      isOpen.value = true;
      return;
    }

    isOpen.value = false;
  };

  const close = () => {
    isOpen.value = false;
    currentItem.value = null;
  };

  return {
    isOpen,
    currentItem,
    normalizedPath,
    mediaUrl,
    posterUrl,
    fileExtension,
    isImage,
    isVideo,
    canPreview,
    open,
    close,
  };
});

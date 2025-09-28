<template>
  <VueEasyLightbox
    :visible="isVisible"
    :imgs="imageList"
    :index="0"
    :escDisabled="false"
    @hide="handleClose"
  />
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import VueEasyLightbox from 'vue-easy-lightbox';
import { isPreviewableImage } from '@/config/media';

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

const isVisible = ref(false);

const previewSrc = computed(() => props.previewUrl || props.context?.previewUrl || null);

const imageList = computed(() => (previewSrc.value ? [previewSrc.value] : []));

const ensureVisible = () => {
  if (previewSrc.value && isPreviewableImage(props.context?.extension)) {
    isVisible.value = true;
  } else {
    isVisible.value = false;
  }
};

const handleClose = () => {
  isVisible.value = false;
  props.context?.api?.closePreview?.();
};

onMounted(() => {
  ensureVisible();
});

watch(previewSrc, () => {
  ensureVisible();
});

watch(
  () => props.context?.extension,
  () => {
    ensureVisible();
  },
);
</script>

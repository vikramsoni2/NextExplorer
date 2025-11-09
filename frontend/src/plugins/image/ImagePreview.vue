<template>
  <VueEasyLightbox
    :visible="visible"
    :imgs="images"
    :index="0"
    @hide="handleClose"
  />
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import VueEasyLightbox from 'vue-easy-lightbox';

// Props - matches context structure
const props = defineProps({
  item: { type: Object, required: true },
  extension: { type: String, required: true },
  filePath: { type: String, required: true },
  previewUrl: { type: String, required: true },
  api: { type: Object, required: true },
});

const visible = ref(false);

// Simple image array for lightbox
const images = computed(() => {
  return props.previewUrl ? [props.previewUrl] : [];
});

// Open lightbox on mount
onMounted(() => {
  if (images.value.length > 0) {
    visible.value = true;
  }
});

// Close handler
const handleClose = () => {
  visible.value = false;
  props.api.close();
};
</script>
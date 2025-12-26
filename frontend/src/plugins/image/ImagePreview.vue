<template>
  <VueEasyLightbox
    :visible="visible"
    :imgs="images"
    :index="currentIndex"
    :loop="true"
    @hide="handleClose"
  />
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import VueEasyLightbox from 'vue-easy-lightbox';
import { isPreviewableImage } from '@/config/media';

const props = defineProps({
  item: { type: Object, required: true },
  extension: { type: String, required: true },
  filePath: { type: String, required: true },
  previewUrl: { type: String, required: true },
  api: { type: Object, required: true },
});

const visible = ref(false);

const galleryItems = computed(() => {
  const siblings = props.api.getSiblings(props.item) || [];
  const all = [...siblings];
  return all.filter((it) => {
    if (!it || it.kind === 'directory') return false;
    const kind = String(it.kind || '').toLowerCase();
    if (kind) return isPreviewableImage(kind);
    const name = String(it.name || '');
    const dot = name.lastIndexOf('.');
    const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
    return isPreviewableImage(ext);
  });
});

const images = computed(() =>
  galleryItems.value
    .map((it) => ({ src: props.api.getPreviewUrl(it), title: it.name }))
    .filter((x) => x.src),
);

const currentIndex = computed(() => {
  const idx = images.value.findIndex((img) => img.title === props.item.name);
  return idx >= 0 ? idx : 0;
});

onMounted(() => {
  visible.value = true;
});

const handleClose = () => {
  visible.value = false;
  props.api.close();
};
</script>

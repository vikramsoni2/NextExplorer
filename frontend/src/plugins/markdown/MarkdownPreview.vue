<template>
  <div class="flex h-full flex-col overflow-y-auto">
    <div
      v-if="isLoading"
      class="flex flex-1 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400"
    >
      Loading markdown…
    </div>
    <div
      v-else-if="error"
      class="p-6 text-sm text-red-600 dark:text-red-400"
    >
      {{ error }}
    </div>
    <article
      v-else
      class="prose prose-slate dark:prose-invert mx-auto w-full max-w-3xl flex-1 px-6 py-8"
      v-html="renderedHtml"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import DOMPurify from 'dompurify';

const props = defineProps({
  context: {
    type: Object,
    required: true,
  },
});

const isLoading = ref(false);
const renderedHtml = ref('');
const error = ref('');

let markedRenderer;
const ensureMarked = async () => {
  if (markedRenderer) return markedRenderer;
  const module = await import('marked');
  markedRenderer = module.marked || module.default || module;
  return markedRenderer;
};

const loadContent = async () => {
  const filePath = props.context?.filePath;
  if (!filePath) {
    renderedHtml.value = '';
    return;
  }

  isLoading.value = true;
  error.value = '';

  try {
    const response = await props.context.api.fetchFileContent(filePath);
    const source = typeof response?.content === 'string' ? response.content : '';
    const marked = await ensureMarked();
    const rawHtml = marked.parse(source);
    renderedHtml.value = DOMPurify.sanitize(rawHtml);
  } catch (err) {
    console.error('Failed to load markdown preview', err);
    error.value = err?.message || 'Unable to render markdown preview.';
    renderedHtml.value = '';
  } finally {
    isLoading.value = false;
  }
};

watch(
  () => props.context?.filePath,
  () => {
    loadContent();
  },
  { immediate: true },
);

</script>

<!-- MarkdownPreview.vue -->
<template>
  <div class="flex h-full flex-col overflow-y-auto">
    <div
      v-if="loading"
      class="flex flex-1 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400"
    >
      Loading markdown…
    </div>
    <div v-else-if="error" class="p-6 text-sm text-red-600 dark:text-red-400">
      {{ error }}
    </div>
    <article
      v-else
      class="prose prose-slate dark:prose-invert mx-auto w-full max-w-3xl flex-1 px-6 py-8"
      v-html="html"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import DOMPurify from 'dompurify';

const props = defineProps({
  item: { type: Object, required: true },
  extension: { type: String, required: true },
  filePath: { type: String, required: true },
  previewUrl: { type: String, required: true },
  api: { type: Object, required: true },
});

const loading = ref(false);
const html = ref('');
const error = ref('');

onMounted(async () => {
  loading.value = true;
  error.value = '';

  try {
    // Lazy load marked
    const { marked } = await import('marked');

    // Fetch content
    const response = await props.api.fetchContent();
    const content = response?.content || '';

    // Parse and sanitize
    const rawHtml = marked.parse(content);
    html.value = DOMPurify.sanitize(rawHtml);
  } catch (err) {
    console.error('Markdown preview failed:', err);
    error.value = err?.message || 'Unable to render markdown preview.';
  } finally {
    loading.value = false;
  }
});
</script>

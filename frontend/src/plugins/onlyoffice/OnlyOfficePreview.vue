<template>
  <div class="h-full w-full bg-white dark:bg-zinc-900">
    <div
      v-if="error"
      class="flex h-full items-center justify-center text-sm text-red-600 dark:text-red-400"
    >
      {{ error }}
    </div>
    <div
      v-else-if="!ready"
      class="flex h-full items-center justify-center text-sm text-neutral-500 dark:text-neutral-400"
    >
      Loading ONLYOFFICE…
    </div>
    <DocumentEditor
      v-else
      class="h-full w-full"
      :key="editorId"
      :id="editorId"
      :shardkey="false"
      :documentServerUrl="serverUrl"
      :config="config"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { DocumentEditor } from '@onlyoffice/document-editor-vue';
import { fetchOnlyOfficeConfig } from '@/api';

const props = defineProps({
  item: { type: Object, required: true },
  extension: { type: String, required: true },
  filePath: { type: String, required: true },
  previewUrl: { type: String, required: true },
  api: { type: Object, required: true },
});

const serverUrl = ref(null);
const config = ref(null);
const error = ref(null);
const ready = computed(() => Boolean(serverUrl.value && config.value));
const editorId = computed(() => {
  const base = (props.context?.filePath || 'document').toString();
  return (
    'onlyoffice-' +
    base
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
  );
});

const load = async () => {
  error.value = null;
  serverUrl.value = null;
  config.value = null;
  try {
    const path = props.filePath;
    if (!path) throw new Error('Missing file path.');
    const { documentServerUrl, config: cfg } = await fetchOnlyOfficeConfig(
      path,
      'edit',
    );
    serverUrl.value = documentServerUrl;
    console.log('ONLYOFFICE config:', cfg);
    config.value = cfg;
  } catch (e) {
    error.value = e?.message || 'Failed to initialize ONLYOFFICE.';
  }
};

onMounted(load);
watch(
  () => props.filePath,
  () => load(),
);
</script>

<style scoped>
/* The editor fills the available area */
:deep(.onlyoffice-editor) {
  height: 100% !important;
}
</style>

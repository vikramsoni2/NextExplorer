<script setup>
import { computed } from 'vue';

import { apiBase, appendAuthQuery } from '@/api';

import TxtIcon from './files/txt-icon.vue';
import DirectoryIcon from './files/directory-icon.vue';
import CodeIcon from './files/code-icon.vue';

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
});

const thumbnailUrl = computed(() => {
  const thumbnailPath = props.item?.thumbnail;
  if (!thumbnailPath) {
    return null;
  }

  if (/^https?:\/\//i.test(thumbnailPath)) {
    return thumbnailPath;
  }

  return appendAuthQuery(`${apiBase}${thumbnailPath}`);
});
</script>

<template>
  <DirectoryIcon v-if="props.item.kind === 'directory'" />
  <CodeIcon v-else-if="['json', 'vue'].includes(props.item.kind)" />
  <div v-else-if="thumbnailUrl" class="flex items-center justify-center">
    <img :src="thumbnailUrl" alt="Preview thumbnail" />
  </div>
  <TxtIcon v-else />
</template>

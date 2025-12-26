<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { search as searchApi, normalizePath } from '@/api';
import FileIcon from '@/icons/FileIcon.vue';

const route = useRoute();
const { t } = useI18n();
const router = useRouter();

const items = ref([]);
const loading = ref(false);
const errorMsg = ref('');

const q = computed(() =>
  typeof route.query.q === 'string' ? route.query.q : '',
);
const basePath = computed(() =>
  normalizePath(typeof route.query.path === 'string' ? route.query.path : ''),
);

async function load() {
  const term = q.value.trim();
  items.value = [];
  errorMsg.value = '';
  if (!term) return;
  loading.value = true;
  try {
    const { items: list = [] } = await searchApi(basePath.value, term);
    items.value = Array.isArray(list) ? list : [];
  } catch (e) {
    errorMsg.value = e?.message || t('errors.searchFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => [q.value, basePath.value], load);

function openResult(it) {
  if (!it) return;
  const kind = it.kind === 'dir' ? 'dir' : 'file';
  // Open the matched folder itself for directories; open parent for files
  const target =
    kind === 'dir'
      ? [it.path, it.name].filter(Boolean).join('/')
      : it.path || '';
  const normalized = normalizePath(target || '');
  router.push({ name: 'FolderView', params: { path: normalized } });
}

function toIconItem(it) {
  if (!it) return { name: '', path: '', kind: 'unknown' };
  const isDir = it.kind === 'dir';
  let ext = 'unknown';
  if (!isDir) {
    const name = String(it.name || '');
    const idx = name.lastIndexOf('.');
    if (idx > 0 && idx < name.length - 1) {
      ext = name.slice(idx + 1).toLowerCase();
      if (ext.length > 10) ext = 'unknown';
    } else {
      ext = 'unknown';
    }
  }
  return {
    name: it.name,
    path: it.path,
    kind: isDir ? 'directory' : ext,
  };
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="text-sm text-neutral-600 dark:text-neutral-300">
      <span v-if="q">{{ $t('search.resultsFor', { q }) }}</span>
      <span v-if="basePath">
        {{ $t('common.in') }}
        <span class="font-mono">/{{ basePath }}</span></span
      >
    </div>

    <div v-if="loading" class="text-sm text-neutral-500 dark:text-neutral-400">
      {{ $t('search.searching') }}
    </div>
    <div v-else-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</div>
    <div
      v-else-if="items.length === 0"
      class="text-sm text-neutral-500 dark:text-neutral-400"
    >
      {{ $t('search.noMatches') }}
    </div>

    <div
      v-else
      class="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800 rounded-md overflow-hidden"
    >
      <div
        v-for="it in items"
        :key="it.path + '/' + it.name"
        class="flex items-center justify-between p-3 bg-white dark:bg-zinc-800/50"
      >
        <div class="flex items-center gap-3 min-w-0">
          <FileIcon :item="toIconItem(it)" class="w-12 h-12 shrink-0" />
          <div class="min-w-0">
            <div class="font-medium truncate">{{ it.name }}</div>
            <div class="text-xs text-neutral-500 font-mono truncate">
              /{{ it.path }}
            </div>
            <div
              v-if="it.matchLine"
              class="mt-1 text-xs text-neutral-700 dark:text-neutral-300 font-mono truncate"
            >
              <template v-if="Number.isFinite(it.matchLineNumber)"
                >{{ $t('search.line') }} {{ it.matchLineNumber }} · </template
              >{{ it.matchLine }}
            </div>
          </div>
        </div>
        <div class="shrink-0 ml-4">
          <button
            class="px-3 py-1 text-sm rounded-md bg-neutral-200 hover:bg-neutral-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"
            @click="openResult(it)"
          >
            {{ $t('search.openFolder') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

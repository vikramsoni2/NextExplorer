<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDebounceFn, useMagicKeys, whenever, onKeyStroke } from '@vueuse/core';
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import { search as searchApi, normalizePath } from '@/api';
import { useSpotlightStore } from '@/stores/spotlight';
import FileIcon from '@/icons/FileIcon.vue';
import { useI18n } from 'vue-i18n';

const router = useRouter();
const route = useRoute();
const spotlight = useSpotlightStore();
const { t } = useI18n();


const query = ref('');
const inputRef = ref(null);
const results = ref([]);
const loading = ref(false);
const errorMsg = ref('');
const activeIndex = ref(-1);


const basePath = computed(() => {
  const fromBrowse = route.path.startsWith('/browse') && typeof route.params.path === 'string' 
    ? route.params.path 
    : '';
  const fromQuery = typeof route.query.path === 'string' ? route.query.path : '';
  return normalizePath(fromBrowse || fromQuery || '');
});

const performSearch = useDebounceFn(async () => {
  const term = query.value.trim();
  
  results.value = [];
  errorMsg.value = '';
  activeIndex.value = -1;
  
  if (!term) return;
  
  loading.value = true;
  try {
    const { items = [] } = await searchApi(basePath.value, term);
    results.value = Array.isArray(items) ? items : [];
  } catch (e) {
    errorMsg.value = e?.message || t('search.failed');
  } finally {
    loading.value = false;
  }
}, 1000);


function navigateDown() {
  const count = results.value.length;
  if (count === 0) return;
  activeIndex.value = (activeIndex.value + 1) % count;
}

function navigateUp() {
  const count = results.value.length;
  if (count === 0) return;
  activeIndex.value = (activeIndex.value - 1 + count) % count;
}

function selectResult() {
  if (results.value.length === 0) return;
  const selectedItem = results.value[Math.max(0, activeIndex.value)];
  if (selectedItem) openResult(selectedItem);
}

function openResult(item) {
  if (!item) return;
  
  const isDirectory = item.kind === 'dir';
  const targetPath = isDirectory
    ? [item.path, item.name].filter(Boolean).join('/')
    : item.path || '';
  
  const normalizedPath = normalizePath(targetPath);
  // For files, open parent folder and preselect the file in that folder.
  // For directories, just open the directory (no preselection since it's not listed inside itself).
  if (!isDirectory && item.name) {
    router.push({ path: `/browse/${normalizedPath}`, query: { select: item.name } });
  } else {
    router.push({ path: `/browse/${normalizedPath}` });
  }
  spotlight.close();
}




function isEditableElement(el) {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  if (['input', 'textarea', 'select'].includes(tag)) return true;
  return el.isContentEditable;
}

function shouldIgnoreKeyboard() {
  return isEditableElement(document.activeElement);
}

function resetSpotlight() {
  query.value = '';
  results.value = [];
  errorMsg.value = '';
  activeIndex.value = -1;
}

function toIconItem(item) {
  if (!item) return { name: '', path: '', kind: 'unknown' };
  
  if (item.kind === 'dir') {
    return { name: item.name, path: item.path, kind: 'directory' };
  }
  
  const name = String(item.name || '');
  const lastDotIndex = name.lastIndexOf('.');
  const ext = lastDotIndex > -1 ? name.slice(lastDotIndex + 1).toLowerCase() : '';
  const kind = (ext && ext.length <= 10) ? ext : 'unknown';
  
  return { name: item.name, path: item.path, kind };
}



watch(query, performSearch);

watch(() => spotlight.isOpen, async (isOpen) => {
  if (isOpen) {
    await nextTick();
    resetSpotlight();
    inputRef.value?.focus();
  }
});



const keys = useMagicKeys();
const openCombo = computed(() => keys['Meta+K']?.value || keys['Ctrl+K']?.value);
const closeCombo = computed(() => keys.escape?.value && spotlight.isOpen);

whenever(openCombo, () => {
  if (!spotlight.isOpen && !shouldIgnoreKeyboard()) {
    spotlight.open();
  }
});

whenever(closeCombo, () => {
  spotlight.close();
});

onKeyStroke('ArrowDown', (e) => {
  if (!spotlight.isOpen) return;
  e.preventDefault();
  navigateDown();
}, { eventName: 'keydown' });

onKeyStroke('ArrowUp', (e) => {
  if (!spotlight.isOpen) return;
  e.preventDefault();
  navigateUp();
}, { eventName: 'keydown' });

onKeyStroke('Enter', (e) => {
  if (!spotlight.isOpen) return;
  e.preventDefault();
  selectResult();
}, { eventName: 'keydown' });

</script>

<template>
  <transition name="fade">
    <div v-if="spotlight.isOpen" class="fixed inset-0 z-[550] flex items-start justify-center pt-[10vh]">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="spotlight.close()"></div>

      <div class="relative w-[90%] sm:w-[640px] max-w-[720px] rounded-2xl shadow-2xl border border-neutral-200/70 dark:border-neutral-700/60 bg-white/90 dark:bg-zinc-800/95 overflow-hidden">
        <!-- Input row -->
        <div class="flex items-center gap-2 px-4 py-3 border-b border-neutral-200/70 dark:border-neutral-800/80">
          <MagnifyingGlassIcon class="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            spellcheck="false"
            :placeholder="t('spotlight.placeholder')"
            class="flex-1 bg-transparent outline-none text-[15px] placeholder-neutral-400 dark:placeholder-neutral-500 text-neutral-900 dark:text-neutral-100"
          />
          <div class="hidden sm:flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
            <span class="px-1.5 py-[2px] rounded border text-white border-neutral-500 dark:border-neutral-700 bg-neutral-500 dark:bg-neutral-900">Esc</span>
            <span>{{ t('spotlight.close') }}</span>
          </div>
        </div>

        <!-- Results -->
        <div class="max-h-[60vh] overflow-y-auto">
          <div v-if="loading" class="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">{{ t('search.searching') }}</div>
          <div v-else-if="errorMsg" class="px-4 py-3 text-sm text-red-600">{{ errorMsg }}</div>
          <div v-else-if="!query.trim()" class="px-4 py-6 text-sm text-neutral-500 dark:text-neutral-400">{{ t('spotlight.hintWithin') }} <span class="font-mono">/{{ basePath }}</span></div>
          <div v-else-if="results.length === 0" class="px-4 py-6 text-sm text-neutral-500 dark:text-neutral-400">{{ t('search.noMatches') }}</div>

          <div v-else class="divide-y divide-neutral-100 dark:divide-neutral-800">
            <button
              v-for="(item, idx) in results"
              :key="item.path + '/' + item.name"
              type="button"
              class="w-full text-left px-3 py-2 hover:bg-zinc-300/60 dark:hover:bg-slate-300/10 focus:bg-blue-50/70 dark:focus:bg-blue-500/10 outline-none"
              :class="{ 'bg-zinc-300/60 dark:bg-slate-300/10': idx === activeIndex }"
              @mouseenter="activeIndex = idx"
              @click="openResult(item)"
            >
              <div class="flex items-center gap-3">
                <FileIcon :item="toIconItem(item)" class="w-8 h-8 shrink-0" />
                <div class="min-w-0">
                  <div class="text-[15px] text-neutral-900 dark:text-neutral-100 truncate">{{ item.name }}</div>
                  <div class="text-[12px] text-neutral-500 dark:text-neutral-400 font-mono truncate">/{{ item.path }}</div>
                  <div v-if="item.matchLine" class="mt-0.5 text-xs text-zinc-600 dark:text-yellow-500 font-mono truncate">
                    <template v-if="Number.isFinite(item.matchLineNumber)">
                      <span class="text-zinc-500 dark:text-zinc-300 pr-2">{{ t('search.line') }} #{{ item.matchLineNumber }}</span>
                    </template>
                    {{ item.matchLine }}
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.12s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

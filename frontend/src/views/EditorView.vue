<template>
  <div class="flex h-full w-full flex-col bg-white dark:bg-default">
    <header
      class="sticky top-0 z-40 flex flex-wrap items-center gap-4 border-b border-neutral-200 bg-white/90 px-4 py-2 shadow-xs backdrop-blur dark:border-neutral-900 dark:bg-default"
    >
      <div class="min-w-0">
        <p class="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Editing
        </p>
        <h1 class="truncate text-md text-neutral-900 dark:text-white">
          {{ normalizedPath || '—' }}
        </h1>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <span v-if="saveError" class="text-sm text-red-600 dark:text-red-400">
          {{ saveError }}
        </span>
        <p v-if="hasUnsavedChanges" class="mr-4 text-xs text-amber-600 dark:text-amber-400">
          Unsaved changes
        </p>
        <button
          type="button"
          @click="openRaw"
          :disabled="isLoading || !normalizedPath"
          class="rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white border dark:border-zinc-700"
          aria-label="Raw"
          title="Raw"
        >
          Raw
        </button>
        <div ref="themeMenuRef" class="relative">
          <button
            type="button"
            class="rounded-md p-1 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
            aria-haspopup="listbox"
            :aria-expanded="isThemeMenuOpen"
            :aria-label="`Theme: ${currentThemeLabel}`"
            :title="`Theme: ${currentThemeLabel}`"
            @click="isThemeMenuOpen = !isThemeMenuOpen"
          >
            <Color20Regular class="h-5 w-5" />
          </button>
          <div
            v-if="isThemeMenuOpen"
            class="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-800"
            role="listbox"
            :aria-label="`Select editor theme`"
          >
            <div class="max-h-80 overflow-auto py-1">
              <button
                v-for="opt in themeOptions"
                :key="opt.id"
                type="button"
                role="option"
                :aria-selected="opt.id === themeId"
                class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-white/10"
                @click="updateTheme(opt.id)"
              >
                <span class="min-w-0 truncate">{{ opt.label }}</span>
                <span
                  v-if="opt.id === themeId"
                  class="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent dark:bg-white/10 dark:text-white"
                >
                  Active
                </span>
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          @click="saveFile"
          :disabled="!canSave"
          class="rounded-md p-1 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
          :aria-label="$t('common.save')"
          :title="$t('common.save')"
        >
          <ArrowPathIcon v-if="isSaving" class="h-6 w-6 animate-spin shrink-0" />
          <Save20Regular v-else class="h-6 w-6 shrink-0" />
        </button>

        <div ref="settingsMenuRef" class="relative">
          <button
            type="button"
            class="rounded-full p-1 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
            aria-haspopup="true"
            :aria-expanded="isSettingsMenuOpen"
            aria-label="Editor settings"
            title="Editor settings"
            @click="isSettingsMenuOpen = !isSettingsMenuOpen"
          >
            <EllipsisVerticalIcon class="h-5 w-5" />
          </button>
          <div
            v-if="isSettingsMenuOpen"
            class="absolute right-0 z-50 mt-2 w-32 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-800"
            role="menu"
          >
            <div class="py-1">
              <button
                type="button"
                role="menuitem"
                class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-white/10"
                @click="toggleLineWrapping"
              >
                <span>Wrap lines</span>
                <CheckIcon v-if="isLineWrapping" class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          @click="requestClose"
          :disabled="isSaving"
          class="rounded-md p-1 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
          :aria-label="$t('common.close')"
          :title="$t('common.close')"
        >
          <XMarkIcon class="h-5 w-5" />
        </button>
      </div>
    </header>

    <section class="flex-1 min-h-0">
      <div
        v-if="isLoading"
        class="flex h-full items-center justify-center text-sm text-neutral-500 dark:text-neutral-400"
      >
        Loading file…
      </div>
      <div v-else-if="loadError" class="p-6 text-sm text-red-600 dark:text-red-400">
        {{ loadError }}
      </div>
      <div v-else class="h-full">
        <Codemirror
          v-model="fileContent"
          :autofocus="true"
          :extensions="extensions"
          class="h-full"
          :style="{ height: '100%' }"
          @ready="handleReady"
        />
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, shallowRef, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Codemirror } from 'vue-codemirror';
import { Compartment } from '@codemirror/state';
import { fetchFileContent, saveFileContent, getRawFileUrl, normalizePath } from '@/api';
import { EditorView, keymap } from '@codemirror/view';
import * as themeBundle from '@fsegurai/codemirror-theme-bundle';
import {
  XMarkIcon,
  ArrowPathIcon,
  PaintBrushIcon,
  EllipsisVerticalIcon,
  CheckIcon,
} from '@heroicons/vue/24/outline';
import { Save20Regular, Color20Regular } from '@vicons/fluent';
import { onClickOutside, onKeyStroke, useLocalStorage } from '@vueuse/core';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

// State
const fileContent = ref('');
const originalContent = ref('');
const isLoading = ref(false);
const isSaving = ref(false);
const loadError = ref('');
const saveError = ref('');
const view = shallowRef(null);
const isThemeMenuOpen = ref(false);
const themeMenuRef = ref(null);
const isSettingsMenuOpen = ref(false);
const settingsMenuRef = ref(null);
const isLineWrapping = ref(true); // Default to true
onClickOutside(themeMenuRef, () => {
  isThemeMenuOpen.value = false;
});
onClickOutside(settingsMenuRef, () => {
  isSettingsMenuOpen.value = false;
});

// Theme
const themeId = useLocalStorage('editor:theme', 'vsCodeDark');
const themeOptions = Object.keys(themeBundle)
  .filter((k) => !k.includes('Merge'))
  .map((k) => ({
    id: k,
    label: k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()),
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

const currentThemeLabel = computed(
  () => themeOptions.find((o) => o.id === themeId.value)?.label ?? themeId.value
);

// Editor Setup
const languageComp = new Compartment();
const themeComp = new Compartment();
const lineWrappingComp = new Compartment();
const customKeymap = keymap.of([
  {
    key: 'Alt-z',
    run: () => {
      toggleLineWrapping();
      return true;
    },
  },
]);

const extensions = [
  languageComp.of([]),
  themeComp.of(themeBundle[themeId.value] ?? themeBundle.githubDark),
  lineWrappingComp.of([]),
  customKeymap,
];

const handleReady = ({ view: v }) => {
  view.value = v;
};

const updateTheme = (id) => {
  themeId.value = id;
  isThemeMenuOpen.value = false;
  view.value?.dispatch({
    effects: themeComp.reconfigure(themeBundle[id] ?? themeBundle.githubDark),
  });
};

// File Info
const normalizedPath = computed(() =>
  normalizePath(
    Array.isArray(route.params.path) ? route.params.path.join('/') : route.params.path || ''
  )
);
const hasUnsavedChanges = computed(() => fileContent.value !== originalContent.value);
const canSave = computed(
  () => hasUnsavedChanges.value && !isSaving.value && !isLoading.value && !loadError.value
);

// Operations
const loadFile = async (path) => {
  if (!path) return (fileContent.value = '');

  isLoading.value = true;
  loadError.value = '';
  saveError.value = '';

  try {
    const { content } = await fetchFileContent(path);
    if (path !== normalizedPath.value) return; // Stale check

    fileContent.value = originalContent.value = content || '';
    applyLanguage(path);
  } catch (err) {
    if (path !== normalizedPath.value) return;
    loadError.value = err.message;
  } finally {
    if (path === normalizedPath.value) isLoading.value = false;
  }
};

const saveFile = async () => {
  if (!canSave.value || !normalizedPath.value) return;
  isSaving.value = true;
  saveError.value = '';
  try {
    await saveFileContent(normalizedPath.value, fileContent.value);
    originalContent.value = fileContent.value;
  } catch (err) {
    saveError.value = err.message;
  } finally {
    isSaving.value = false;
  }
};

const openRaw = () => {
  if (!normalizedPath.value) return;
  const url = getRawFileUrl(normalizedPath.value);
  window.open(url, '_blank', 'noopener,noreferrer');
};

const requestClose = () => {
  if (isSaving.value) return;
  if (hasUnsavedChanges.value && !confirm(t('editor.confirmCloseWithoutSaving'))) return;

  const parts = normalizedPath.value.split('/').filter(Boolean);
  parts.pop();
  router.replace(`/browse${parts.length ? '/' + parts.join('/') : ''}`);
};

const applyLanguage = async (path) => {
  if (!view.value) return;
  const ext = path.split('.').pop().toLowerCase();

  try {
    const { languages } = await import('@codemirror/language-data');
    // Simplified matching: extension -> name -> fallback for frameworks
    const desc =
      languages.find((l) => l.extensions?.includes(ext) || l.name?.toLowerCase() === ext) ??
      (['vue', 'svelte', 'astro'].includes(ext) ? languages.find((l) => l.name === 'HTML') : null);

    view.value.dispatch({
      effects: languageComp.reconfigure(desc ? await desc.load() : []),
    });
  } catch (e) {
    console.warn('Language error:', e);
  }
};

// Interaction
const toggleLineWrapping = () => {
  isLineWrapping.value = !isLineWrapping.value;
  view.value?.dispatch({
    effects: lineWrappingComp.reconfigure(isLineWrapping.value ? EditorView.lineWrapping : []),
  });
};

onKeyStroke('Escape', () =>
  isThemeMenuOpen.value ? (isThemeMenuOpen.value = false) : requestClose()
);
onKeyStroke(['s', 'S'], (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    saveFile();
  }
});

watch(normalizedPath, loadFile, { immediate: true });
watch(view, () => applyLanguage(normalizedPath.value));
watch(fileContent, () => {
  if (saveError.value) saveError.value = '';
});
</script>

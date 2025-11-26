<template>
  <div class="flex h-full w-full flex-col bg-white dark:bg-zinc-900">
    <header
      class="flex flex-wrap items-center gap-4 border-b border-neutral-200 bg-white px-6 py-2 shadow-xs
             dark:border-neutral-700 dark:bg-zinc-800"
    >
      <div class="min-w-0">
        <p class="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Editing</p>
        <h1 class="truncate text-lg font-semibold text-neutral-900 dark:text-white">
          {{ displayPath || '—' }}
        </h1>
        <p v-if="hasUnsavedChanges" class="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</p>
      </div>
      <div class="ml-auto flex items-center gap-3">
        <span v-if="saveError" class="text-sm text-red-600 dark:text-red-400">
          {{ saveError }}
        </span>
        <button
          type="button"
          @click="cancelEditing"
          :disabled="!canCancel"
          class="rounded-md border border-neutral-300 px-3 py-1 text-sm font-medium text-neutral-700 transition
                 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60
                 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-700"
        >
          Cancel
        </button>
        <button
          type="button"
          @click="saveFile"
          :disabled="!canSave"
          class="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white transition
                 hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-400 disabled:opacity-70"
        >
          {{ isSaving ? 'Saving…' : 'Save' }}
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
      <div
        v-else-if="loadError"
        class="p-6 text-sm text-red-600 dark:text-red-400"
      >
        {{ loadError }}
      </div>
      <div v-else class="h-full">
        <Codemirror
          v-model="fileContent"
          :autofocus="true"
          :extensions="editorExtensions"
          class="h-full"
          :style="{ height: '100%' }"
          @ready="handleReady"
        />
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Codemirror } from 'vue-codemirror';
import { Compartment } from '@codemirror/state';
import { fetchFileContent, saveFileContent, normalizePath } from '@/api';
import { githubDark } from '@fsegurai/codemirror-theme-github-dark'


const route = useRoute();
const router = useRouter();

const fileContent = ref('');
const originalContent = ref('');
const isLoading = ref(false);
const isSaving = ref(false);
const loadError = ref('');
const saveError = ref('');

const view = shallowRef(null);
const handleReady = (payload) => {
  view.value = payload.view;
};

const rawPathParam = computed(() => {
  const param = route.params.path;
  if (Array.isArray(param)) {
    return param.join('/');
  }
  return param || '';
});

const normalizedPath = computed(() => normalizePath(rawPathParam.value));
const displayPath = computed(() => normalizedPath.value || '');
const fileExtension = computed(() => {
  const segments = normalizedPath.value.split('.');
  return segments.length > 1 ? segments.pop().toLowerCase() : '';
});

// Language compartment allows reconfiguring language without recreating the editor
const language = new Compartment();

// Base extensions: theme + an empty language compartment (configured dynamically)
const editorExtensions = computed(() => [
  language.of([]),
  githubDark,
]);

const hasUnsavedChanges = computed(() => fileContent.value !== originalContent.value);
const canSave = computed(() => hasUnsavedChanges.value && !isSaving.value && !isLoading.value && !loadError.value);
const canCancel = computed(() => !isSaving.value);

const resetStatus = () => {
  saveError.value = '';
};

let loadRequestId = 0;

const loadFile = async () => {
  const targetPath = normalizedPath.value;

  if (!targetPath) {
    fileContent.value = '';
    originalContent.value = '';
    loadError.value = 'No file selected.';
    return;
  }

  isLoading.value = true;
  loadError.value = '';
  resetStatus();

  const requestId = ++loadRequestId;

  try {
    const response = await fetchFileContent(targetPath);
    if (requestId !== loadRequestId) {
      return;
    }
    const content = typeof response?.content === 'string' ? response.content : '';
    originalContent.value = content;
    fileContent.value = content;
  } catch (error) {
    console.error('Failed to load file:', error);
    if (requestId === loadRequestId) {
      loadError.value = error?.message || 'Failed to load file.';
    }
  } finally {
    if (requestId === loadRequestId) {
      isLoading.value = false;
    }
  }
};

const saveFile = async () => {
  if (!canSave.value) return;

  const targetPath = normalizedPath.value;
  if (!targetPath) {
    return;
  }

  isSaving.value = true;
  saveError.value = '';

  try {
    await saveFileContent(targetPath, fileContent.value);
    originalContent.value = fileContent.value;
    closeEditor();
  } catch (error) {
    console.error('Failed to save file:', error);
    saveError.value = error?.message || 'Failed to save file.';
  } finally {
    isSaving.value = false;
  }
};

const cancelEditing = () => {
  if (!canCancel.value) return;
  closeEditor();
};

const closeEditor = () => {
  const segments = normalizedPath.value.split('/').filter(Boolean);
  if (segments.length > 0) {
    segments.pop();
  }
  const destination = `/browse${segments.length > 0 ? `/${segments.join('/')}` : ''}`;
  router.push({ path: destination });
};

const handleKeydown = (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    if (canSave.value) {
      saveFile();
    }
  }
};

// Dynamically load and apply a language based on the file path/extension
const applyLanguageForPath = async () => {
  // Only proceed when the editor view is ready
  if (!view.value) return;

  const currentPath = normalizedPath.value || '';
  const base = currentPath.split('/').filter(Boolean).pop() || '';
  const ext = fileExtension.value;

  try {
    // Lazy import the language registry; this code-splits languages and loads on demand
    const { languages } = await import('@codemirror/language-data');

    // Try to find a language by extension (normalize leading dots if present)
    const matchesExt = (lang, e) => Array.isArray(lang.extensions)
      && lang.extensions.some((x) => String(x).replace(/^\./, '').toLowerCase() === e);

    // Try to find by common aliases or name as a fallback (e.g., dockerfile)
    const matchesName = (lang, name) =>
      (typeof lang.name === 'string' && lang.name.toLowerCase() === name)
      || (Array.isArray(lang.alias) && lang.alias.some(a => String(a).toLowerCase() === name));

    let desc = null;
    if (ext) {
      desc = languages.find((l) => matchesExt(l, ext));
    }

    if (!desc && base) {
      const baseLower = base.toLowerCase();
      desc = languages.find((l) => matchesName(l, baseLower));
    }

    // As a convenience, map a few framework single-file extensions to their closest core language
    if (!desc && ['vue', 'svelte', 'astro'].includes(ext)) {
      desc = languages.find((l) => matchesName(l, 'html'))
        || languages.find((l) => matchesExt(l, 'html'));
    }

    // If we found a language description, load it and reconfigure
    if (desc && typeof desc.load === 'function') {
      const support = await desc.load();
      view.value.dispatch({ effects: language.reconfigure(support) });
      return;
    }

    // Fallback to no specific language (plain text)
    view.value.dispatch({ effects: language.reconfigure([]) });
  } catch (err) {
    // If the language registry is unavailable or errors, fallback silently
    console.warn('Language load failed; falling back to plain text.', err);
    try {
      view.value.dispatch({ effects: language.reconfigure([]) });
    } catch (_) {
      // ignore
    }
  }
};

watch(normalizedPath, () => {
  resetStatus();
  loadFile();
  // Update language when path changes
  applyLanguageForPath();
}, { immediate: true });

watch(fileContent, () => {
  if (saveError.value) {
    saveError.value = '';
  }
});

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  // Apply language when the editor view becomes ready
  const stop = watch(view, (v) => {
    if (v) {
      applyLanguageForPath();
      stop();
    }
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

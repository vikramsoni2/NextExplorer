import { useFeaturesStore } from '@/stores/features';
import { computed } from 'vue';

const DEFAULT_EDITOR_EXTENSIONS = [
  'txt',
  'md',
  'markdown',
  'csv',
  'tsv',
  'json',
  'json5',
  'yml',
  'yaml',
  'xml',
  'log',
  'ini',
  'cfg',
  'conf',
  'env',
  'properties',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'py',
  'rb',
  'php',
  'java',
  'c',
  'h',
  'cpp',
  'hpp',
  'cs',
  'go',
  'rs',
  'swift',
  'kt',
  'scala',
  'sh',
  'bash',
  'zsh',
  'ps1',
  'bat',
  'vue',
  'svelte',
  'astro',
  'html',
  'css',
  'scss',
  'sass',
  'less',
];

// Computed set of all editable extensions (default + runtime from features)
const editableExtensionsSet = computed(() => {
  const featuresStore = useFeaturesStore();
  const runtimeExtensions = featuresStore.editorExtensions || [];
  return new Set([
    ...DEFAULT_EDITOR_EXTENSIONS,
    ...runtimeExtensions,
  ]);
});

const getEditableExtensions = () => Array.from(editableExtensionsSet.value.values());

const isEditableExtension = (extension = '') => {
  if (!extension) return false;
  return editableExtensionsSet.value.has(extension.toLowerCase());
};

export {
  getEditableExtensions,
  isEditableExtension,
};

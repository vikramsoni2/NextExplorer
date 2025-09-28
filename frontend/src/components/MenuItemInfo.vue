<script setup>
import { computed, onMounted, ref } from 'vue';
import { ArrowDownTrayIcon, TrashIcon, ArrowPathIcon, PencilSquareIcon, StarIcon as StarIconOutline } from '@heroicons/vue/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/vue/24/solid';
import { useFileStore } from '@/stores/fileStore';
import { useFavoritesStore } from '@/stores/favorites';
import { normalizePath, downloadItems } from '@/api';

const fileStore = useFileStore();
const favoritesStore = useFavoritesStore();

const selectedItems = computed(() => fileStore.selectedItems);
const selectedItem = computed(() => selectedItems.value[0] ?? null);
const hasSelection = computed(() => selectedItems.value.length > 0);
const isSingleItemSelected = computed(() => selectedItems.value.length === 1);
const isSingleFileSelected = computed(() => isSingleItemSelected.value && selectedItems.value[0]?.kind !== 'directory');
const canRename = computed(() => isSingleItemSelected.value && selectedItems.value[0]?.kind !== 'volume');
const isSingleDirectorySelected = computed(() => isSingleItemSelected.value && selectedItems.value[0]?.kind === 'directory');
const currentPath = computed(() => normalizePath(fileStore.getCurrentPath || ''));
const isPreparingDownload = ref(false);
const isMutatingFavorite = ref(false);

onMounted(() => {
  favoritesStore.ensureLoaded();
});

const getResolvedPaths = () => selectedItems.value
  .map((item) => {
    const parent = normalizePath(item.path || '');
    const combined = parent ? `${parent}/${item.name}` : item.name;
    return normalizePath(combined);
  })
  .filter(Boolean);

const extractFilename = (contentDisposition) => {
  if (!contentDisposition) return null;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/"/g, ''));
    } catch (error) {
      return utf8Match[1].replace(/"/g, '');
    }
  }

  const asciiMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (asciiMatch && asciiMatch[1]) {
    return asciiMatch[1];
  }

  return null;
};

const handleDownload = async () => {
  if (!hasSelection.value || isPreparingDownload.value) return;

  const paths = getResolvedPaths();
  if (!paths.length) return;

  isPreparingDownload.value = true;
  try {
    const response = await downloadItems(paths, currentPath.value);
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition');
    const suggestedName = extractFilename(disposition)
      || (isSingleFileSelected.value && selectedItem.value
        ? selectedItem.value.name
        : selectedItems.value.length === 1 && selectedItem.value
          ? `${selectedItem.value.name}.zip`
          : (() => {
            const segments = currentPath.value.split('/').filter(Boolean);
            const base = segments[segments.length - 1];
            return base ? `${base}.zip` : 'download.zip';
          })());

    const downloadUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.rel = 'noopener';
    anchor.download = suggestedName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
  } catch (error) {
    console.error('Download failed', error);
  } finally {
    isPreparingDownload.value = false;
  }
};

const handleDelete = async () => {
  if (!selectedItems.value.length) return;
  try {
    await fileStore.del();
  } catch (error) {
    console.error('Delete operation failed', error);
  }
};

const handleRename = () => {
  if (!canRename.value) return;
  const target = selectedItems.value[0];
  if (!target) return;
  fileStore.beginRename(target);
};

const selectedDirectoryPath = computed(() => {
  if (!isSingleDirectorySelected.value) {
    return null;
  }

  const target = selectedItem.value;
  if (!target) {
    return null;
  }

  const parent = normalizePath(target.path || '');
  const combined = parent ? `${parent}/${target.name}` : target.name;
  return normalizePath(combined);
});

const isFavoriteDirectory = computed(() => {
  const path = selectedDirectoryPath.value;
  if (!path) {
    return false;
  }
  return favoritesStore.isFavorite(path);
});

const favoriteStarComponent = computed(() => (isFavoriteDirectory.value ? StarIconSolid : StarIconOutline));

const isFavoriteActionDisabled = computed(() => !selectedDirectoryPath.value || isMutatingFavorite.value);

const handleFavoriteAction = async () => {
  const path = selectedDirectoryPath.value;
  if (!path || isMutatingFavorite.value) {
    return;
  }

  isMutatingFavorite.value = true;
  try {
    if (isFavoriteDirectory.value) {
      await favoritesStore.removeFavorite(path);
    } else {
      await favoritesStore.addFavorite({ path, icon: 'solid:StarIcon' });
    }
  } catch (error) {
    console.error('Failed to update favorite', error);
  } finally {
    isMutatingFavorite.value = false;
  }
};
</script>

<template>
  <div class="flex gap-1 items-center">
    <button
      v-if="isSingleDirectorySelected"
      type="button"
      @click="handleFavoriteAction"
      :disabled="isFavoriteActionDisabled"
      class="p-[6px] rounded-md transition-colors hover:bg-[rgb(239,239,240)] active:bg-zinc-200 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      :class="{
        'text-amber-500 dark:text-amber-400': isFavoriteDirectory,
        'opacity-50 cursor-not-allowed': isFavoriteActionDisabled,
      }"
    >
      <component :is="favoriteStarComponent" class="w-6" />
    </button>
    <button
      type="button"
      @click="handleRename"
      :disabled="!canRename"
      class="p-[6px] rounded-md transition-colors
        hover:bg-[rgb(239,239,240)] active:bg-zinc-200
        dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      :class="{ 'opacity-50 cursor-not-allowed': !canRename }"
    >
      <PencilSquareIcon class="w-6" />
    </button>
    <button
      type="button"
      @click="handleDownload"
      :disabled="!hasSelection || isPreparingDownload"
      class="p-[6px] rounded-md transition-colors
        hover:bg-[rgb(239,239,240)] active:bg-zinc-200
        dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      :class="{ 'opacity-50 cursor-not-allowed': !hasSelection || isPreparingDownload }"
    >
      <ArrowPathIcon v-if="isPreparingDownload" class="w-6 animate-spin" />
      <ArrowDownTrayIcon v-else class="w-6" />
    </button>
    <button
      type="button"
      @click="handleDelete"
      :disabled="!hasSelection"
      class="p-[6px] rounded-md transition-colors
        hover:bg-[rgb(239,239,240)] active:bg-zinc-200
        dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      :class="{ 'opacity-50 cursor-not-allowed': !hasSelection }"
    >
      <TrashIcon class="w-6" />
    </button>
  </div>
</template>

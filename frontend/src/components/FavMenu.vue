<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import * as OutlineIcons from '@heroicons/vue/24/outline';
import * as SolidIcons from '@heroicons/vue/24/solid';
import { useFavoritesStore } from '@/stores/favorites';
import { useNavigation } from '@/composables/navigation';
import { normalizePath } from '@/api';
import { useI18n } from 'vue-i18n';
import { useFavoriteEditor } from '@/composables/useFavoriteEditor';

const {
  ChevronDownIcon,
  StarIcon: StarIconOutline,
  PencilSquareIcon,
  XMarkIcon,
  Bars3Icon,
} = OutlineIcons;

const rootEl = ref(null);
const open = ref(true);
const isEditMode = ref(false);
const favoritesStore = useFavoritesStore();
const route = useRoute();
const { openBreadcrumb } = useNavigation();
const { openEditorForFavorite } = useFavoriteEditor();

// Drag and drop state
const draggedItem = ref(null);
const draggedOverItem = ref(null);

const ICON_VARIANTS = {
  outline: OutlineIcons,
  solid: SolidIcons,
};

const resolveIconComponent = (iconName) => {
  if (typeof iconName !== 'string') {
    return StarIconOutline;
  }

  const trimmed = iconName.trim();
  if (!trimmed) {
    return StarIconOutline;
  }

  if (trimmed.includes(':')) {
    const [variantRaw, iconRaw] = trimmed.split(':', 2);
    const variantKey = variantRaw.toLowerCase();
    const iconKey = iconRaw.trim();
    const registry = ICON_VARIANTS[variantKey];
    if (registry && registry[iconKey]) {
      return registry[iconKey];
    }
  }

  return OutlineIcons[trimmed] || SolidIcons[trimmed] || StarIconOutline;
};

const favorites = computed(() => favoritesStore.favorites.map((favorite) => {
  const autoLabel = favorite.path.split('/').pop() || favorite.path;
  return {
    ...favorite,
    label: favorite.label || autoLabel,
    iconComponent: resolveIconComponent(favorite.icon),
    color: favorite.color || null,
  };
}));
const { t } = useI18n();

const currentPath = computed(() => {
  const rawPath = route.params?.path;
  if (Array.isArray(rawPath)) {
    return normalizePath(rawPath.join('/'));
  }
  if (typeof rawPath === 'string') {
    return normalizePath(rawPath);
  }
  return '';
});

const isActiveFav = (favoritePath = '') => {
  const normalizedFavorite = normalizePath(favoritePath || '');
  return normalizedFavorite === currentPath.value;
};

const handleOpenFavorite = (favorite) => {
  if (!favorite?.path) {
    return;
  }
  openBreadcrumb(favorite.path);
};

const toggleEditMode = () => {
  if (!favorites.value.length) return;
  isEditMode.value = !isEditMode.value;
  // Clean up drag state when exiting edit mode
  if (!isEditMode.value) {
    draggedItem.value = null;
    draggedOverItem.value = null;
  }
};

const handleEditFavorite = (favorite) => {
  if (!favorite) return;
  openEditorForFavorite(favorite);
};

const handleRemoveFavorite = async (favorite) => {
  try {
    await favoritesStore.removeFavorite(favorite.path);
  } catch (error) {
    console.error('Failed to remove favorite from sidebar menu', error);
  }
};

const handleGlobalPointerDown = (event) => {
  if (!isEditMode.value) return;
  const el = rootEl.value;
  if (!el) return;
  if (el === event.target || el.contains(event.target)) return;
  isEditMode.value = false;
  // Clean up drag state
  draggedItem.value = null;
  draggedOverItem.value = null;
};

// Drag and drop handlers
const handleDragStart = (event, favorite) => {
  draggedItem.value = favorite;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', favorite.id);
};

const handleDragOver = (event, favorite) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  draggedOverItem.value = favorite;
};

const handleDragEnter = (event, favorite) => {
  event.preventDefault();
  draggedOverItem.value = favorite;
};

const handleDragLeave = (event) => {
  if (event.target.closest('[data-favorite-item]') === null) {
    draggedOverItem.value = null;
  }
};

const handleDrop = async (event, targetFavorite) => {
  event.preventDefault();

  if (!draggedItem.value || !targetFavorite) {
    draggedItem.value = null;
    draggedOverItem.value = null;
    return;
  }

  if (draggedItem.value.id === targetFavorite.id) {
    draggedItem.value = null;
    draggedOverItem.value = null;
    return;
  }

  try {
    // Create a new order array
    const items = [...favorites.value];
    const draggedIndex = items.findIndex(f => f.id === draggedItem.value.id);
    const targetIndex = items.findIndex(f => f.id === targetFavorite.id);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Remove the dragged item and insert it at the target position
    const [removed] = items.splice(draggedIndex, 1);
    // When moving down, adjust target index because we just removed an item before it
    const insertIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
    items.splice(insertIndex, 0, removed);

    // Extract the ordered IDs
    const orderedIds = items.map(f => f.id);

    // Call the store to reorder
    await favoritesStore.reorderFavorites(orderedIds);
  } catch (error) {
    console.error('Failed to reorder favorites', error);
  } finally {
    draggedItem.value = null;
    draggedOverItem.value = null;
  }
};

const handleDragEnd = () => {
  draggedItem.value = null;
  draggedOverItem.value = null;
};

onMounted(() => {
  favoritesStore.ensureLoaded();
  window.addEventListener('pointerdown', handleGlobalPointerDown);
});

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handleGlobalPointerDown);
});
</script>

<template>
  <div ref="rootEl" >
    <h4
      class="group flex items-center justify-between py-2 pt-6 text-sm text-neutral-400 dark:text-neutral-500 font-medium"
    >
      {{ t('favorites.title') }}
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="hidden group-hover:flex items-center justify-center rounded-full
          border border-zinc-400 dark:border-zinc-500 px-3 text-xs
           text-neutral-500  dark:text-neutral-400 "
          
          @click.stop="toggleEditMode"
          :disabled="!favorites.length"
        >
          {{t('common.edit')}}
        </button>
        <button
          @click="open = !open"
          class="hidden group-hover:block active:text-black dark:active:text-white text-neutral-500"
          type="button"
        >
          <ChevronDownIcon
            class="h-4 transition-transform duration-300 ease-in-out"
            :class="{ 'rotate-0': open, '-rotate-90': !open }"
          />
        </button>
      </div>
    </h4>
    <div class="overflow-hidden">
      <transition
        enter-active-class="transition-all duration-500"
        leave-active-class="transition-all duration-500"
        enter-from-class="-mt-[100%]"
        enter-to-class="mt-0"
        leave-from-class="mt-0"
        leave-to-class="-mt-[100%]"
      >
        <div v-if="open" class="overflow-hidden">
          <template v-if="favorites.length">
            <div
              v-for="favorite in favorites"
              :key="favorite.path"
              data-favorite-item
              :draggable="isEditMode"
              @dragstart="isEditMode ? handleDragStart($event, favorite) : null"
              @dragover="isEditMode ? handleDragOver($event, favorite) : null"
              @dragenter="isEditMode ? handleDragEnter($event, favorite) : null"
              @dragleave="isEditMode ? handleDragLeave($event) : null"
              @drop="isEditMode ? handleDrop($event, favorite) : null"
              @dragend="isEditMode ? handleDragEnd : null"
              class="group/item my-3 flex items-center gap-2 transition-all duration-200"
              :class="{
                'opacity-50': isEditMode && draggedItem?.id === favorite.id,
                'border-t-2 border-yellow-500/50 pt-2': isEditMode && draggedOverItem?.id === favorite.id && draggedItem?.id !== favorite.id
              }"
            >
              <Bars3Icon
                v-if="isEditMode"
                class="h-4 w-4 shrink-0 cursor-grab text-neutral-400 group-hover/item:text-white dark:text-neutral-500 dark:group-hover/item:text-neutral-100"
                :class="{ 'cursor-grabbing': draggedItem?.id === favorite.id }"
              />
              <button
                type="button"
                @click="handleOpenFavorite(favorite)"
                class="truncate"
                :class="[
                  'cursor-pointer flex w-full items-center gap-3 rounded-lg transition-colors duration-200 text-sm',
                  isActiveFav(favorite.path)
                    ? 'text-neutral-950 dark:text-white'
                    : 'text-neutral-950 dark:text-neutral-300/80'
                ]"
              >
                <component
                  :is="favorite.iconComponent"
                  class="h-5 shrink-0"
                  :style="{ color: favorite.color || 'currentColor' }"
                />
                <span class="truncate">{{ favorite.label }}</span>
              </button>
              <template v-if="isEditMode">
                <button
                  type="button"
                  class="shrink-0 rounded-md text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
                  @click.stop="handleEditFavorite(favorite)"
                >
                  <PencilSquareIcon class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  class="shrink-0 rounded-md text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/40"
                  @click.stop="handleRemoveFavorite(favorite)"
                >
                  <XMarkIcon class="h-4 w-4" />
                </button>
              </template>
            </div>
          </template>
          <div
            v-else
            class=" my-2 rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-xs text-neutral-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-neutral-400"
          >
            <div class="flex items-center gap-2 text-neutral-500 dark:text-neutral-300">
              <StarIconOutline class="h-4 w-4" />
              <span class="text-sm font-medium text-neutral-600 dark:text-neutral-100">
                {{ t('favorites.emptyTitle') }}
              </span>
            </div>
            <p class="mt-2 leading-relaxed">
              {{ t('favorites.emptyDescription') }}
            </p>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

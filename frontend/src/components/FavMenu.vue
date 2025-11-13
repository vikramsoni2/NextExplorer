<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import * as OutlineIcons from '@heroicons/vue/24/outline';
import * as SolidIcons from '@heroicons/vue/24/solid';
import { useFavoritesStore } from '@/stores/favorites';
import { useNavigation } from '@/composables/navigation';
import { normalizePath } from '@/api';
import { useI18n } from 'vue-i18n';

const { ChevronDownIcon, StarIcon: StarIconOutline } = OutlineIcons;

const open = ref(true);
const favoritesStore = useFavoritesStore();
const route = useRoute();
const { openBreadcrumb } = useNavigation();

onMounted(() => {
  favoritesStore.ensureLoaded();
});

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

const favorites = computed(() => favoritesStore.favorites.map((favorite) => ({
  ...favorite,
  label: favorite.path.split('/').pop() || favorite.path,
  iconComponent: resolveIconComponent(favorite.icon),
})));
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
</script>

<template>
  <h4
    class="group flex items-center justify-between py-2 pt-6 text-sm text-neutral-400 dark:text-neutral-500 font-medium"
  >
    {{ t('favorites.title') }}
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
          <button
            v-for="favorite in favorites"
            :key="favorite.path"
            type="button"
            @click="handleOpenFavorite(favorite)"
            :class="[
                        'cursor-pointer flex w-full items-center gap-3 my-3 rounded-lg transition-colors duration-200 text-sm',
                        isActiveFav(favorite.path)
                            ? 'text-neutral-950 dark:text-white'
                            : 'text-neutral-950 dark:text-neutral-300/80'
                    ]"
          >
            <component :is="favorite.iconComponent" class="h-5 shrink-0" />
            <span class="truncate">{{ favorite.label }}</span>
          </button>
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
</template>

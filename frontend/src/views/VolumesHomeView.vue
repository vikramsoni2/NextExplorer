<script setup>
import { ref, onMounted, computed } from 'vue';
import { useFavoritesStore } from '@/stores/favorites';
import { getVolumes } from '@/api';
import { useNavigation } from '@/composables/navigation';
import * as OutlineIcons from '@heroicons/vue/24/outline';
import * as SolidIcons from '@heroicons/vue/24/solid';

const volumes = ref([]);
const loading = ref(true);
const favoritesStore = useFavoritesStore();
const { openItem, openBreadcrumb } = useNavigation();

onMounted(async () => {
  try {
    favoritesStore.ensureLoaded();
    volumes.value = await getVolumes();
  } finally {
    loading.value = false;
  }
});

const ICON_VARIANTS = {
  outline: OutlineIcons,
  solid: SolidIcons,
};

const resolveIconComponent = (iconName) => {
  if (typeof iconName !== 'string') {
    return OutlineIcons.StarIcon;
  }
  const trimmed = iconName.trim();
  if (!trimmed) return OutlineIcons.StarIcon;
  if (trimmed.includes(':')) {
    const [variantRaw, iconRaw] = trimmed.split(':', 2);
    const variantKey = variantRaw.toLowerCase();
    const iconKey = iconRaw.trim();
    const registry = ICON_VARIANTS[variantKey];
    if (registry && registry[iconKey]) return registry[iconKey];
  }
  return OutlineIcons[trimmed] || SolidIcons[trimmed] || OutlineIcons.StarIcon;
};

const quickAccess = computed(() => favoritesStore.favorites.map((favorite) => ({
  ...favorite,
  label: favorite.path.split('/').pop() || favorite.path,
  iconComponent: resolveIconComponent(favorite.icon),
})));

const handleOpenFavorite = (favorite) => {
  if (!favorite?.path) return;
  openBreadcrumb(favorite.path);
};
</script>

<template>
  <div class="flex flex-col gap-8">
    <!-- Quick Access -->
    <section>
      <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Quick access</h3>
      <div v-if="quickAccess.length" class="flex flex-wrap gap-2">
        <button
          v-for="fav in quickAccess"
          :key="fav.path"
          type="button"
          @click="handleOpenFavorite(fav)"
          class="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 shadow-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-zinc-800 dark:text-neutral-200 dark:hover:bg-zinc-700"
        >
          <component :is="fav.iconComponent" class="h-4 w-4" />
          <span class="truncate max-w-[16rem]">{{ fav.label }}</span>
        </button>
      </div>
      <div v-else class="rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-neutral-400">
        Pin folders as favorites to access them quickly here.
      </div>
    </section>

    <!-- Volumes -->
    <section>
      <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Volumes</h3>
      <div v-if="!loading" class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        <button
          v-for="vol in volumes"
          :key="vol.name"
          type="button"
          @click="openItem(vol)"
          class="flex flex-col items-start gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:border-neutral-300 hover:shadow dark:border-neutral-700 dark:bg-zinc-800 dark:hover:border-neutral-600"
        >
          <component :is="OutlineIcons.ServerIcon" class="h-8 w-8 text-neutral-600 dark:text-neutral-300" />
          <div>
            <div class="truncate text-sm font-medium text-neutral-900 dark:text-white">{{ vol.name }}</div>
            <div class="text-xs text-neutral-500 dark:text-neutral-400">Volume</div>
          </div>
        </button>
      </div>
      <div v-else class="text-sm text-neutral-500 dark:text-neutral-400">Loading volumes…</div>
    </section>
  </div>
</template>

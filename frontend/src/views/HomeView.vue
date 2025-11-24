<script setup>
import { ref, onMounted, computed, defineAsyncComponent } from 'vue';
import { useFavoritesStore } from '@/stores/favorites';
import { useFeaturesStore } from '@/stores/features';
import { getVolumes, getUsage } from '@/api';
import { useNavigation } from '@/composables/navigation';
import * as OutlineIcons from '@heroicons/vue/24/outline';
import * as SolidIcons from '@heroicons/vue/24/solid';
const ProgressBar = defineAsyncComponent(() => import('@/components/ProgressBar.vue'));
import IconDrive from '@/icons/IconDrive.vue';
import { formatBytes } from '@/utils';


const volumes = ref([]);
const loading = ref(true);
const favoritesStore = useFavoritesStore();
const featuresStore = useFeaturesStore();
const usage = ref({});
const { openItem, openBreadcrumb } = useNavigation();
const showVolumeUsage = computed(() => featuresStore.volumeUsageEnabled);

onMounted(async () => {
  try {
    // Ensure features are loaded before checking flags
    await Promise.all([
      favoritesStore.ensureLoaded(),
      featuresStore.ensureLoaded(),
    ]);

    // Load volumes
    volumes.value = await getVolumes();

    // Lazy-load usage for each volume only when the feature is enabled
    if (showVolumeUsage.value) {
      volumes.value.forEach(async (v) => {
        try { usage.value[v.path] = await getUsage(v.path); } catch (_) {}
      });
    }
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

const quickAccess = computed(() => favoritesStore.favorites.map((favorite) => {
  const autoLabel = favorite.path.split('/').pop() || favorite.path;
  return {
    ...favorite,
    label: favorite.label || autoLabel,
    iconComponent: resolveIconComponent(favorite.icon),
    color: favorite.color || null,
  };
}));

const handleOpenFavorite = (favorite) => {
  if (!favorite?.path) return;
  openBreadcrumb(favorite.path);
};
</script>

<template>
  <div class="flex flex-col gap-8 px-8">
    <!-- Quick Access -->
    <section>
      <h3 class="mt-6 mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{{ $t('volumes.quickAccess') }}</h3>
      <div v-if="quickAccess.length" class="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <button
          v-for="fav in quickAccess"
          :key="fav.path"
          type="button"
          :title="fav.label"
          @dblclick="handleOpenFavorite(fav)"
          class="flex items-center gap-3 py-4 rounded-md cursor-pointer select-none
          text-neutral-700 dark:text-neutral-300"
        >
          <component
            :is="fav.iconComponent"
            class="h-12 shrink-0"
            :style="{ color: fav.color || 'currentColor' }"
          />
          <div class="text-sm text-left break-all line-clamp-2 rounded-md px-2 -mx-2">
            {{ fav.label }}
          </div>
        </button>
      </div>
      <div v-else class="text-xs">
        {{ $t('volumes.quickAccessEmpty') }}
      </div>
    </section>

    <!-- Volumes -->
    <section>
      <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{{ $t('volumes.title') }}</h3>
      <div v-if="!loading" class="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        
        <button
          v-for="vol in volumes"
          :key="vol.name"
          type="button"
          @dblclick="openItem(vol)"
          class="flex items-center gap-3 py-4 text-left  "
        >
          <IconDrive class="h-16 shrink-0"/>
          <div>
            <div class="mb-1 truncate text-sm font-medium text-neutral-900 dark:text-white">{{ vol.name }}</div>
            <template v-if="showVolumeUsage">
              <template v-if="usage[vol.path]">
                <ProgressBar
                  :used="usage[vol.path].size || 0"
                  :total="usage[vol.path].total || ((usage[vol.path].size || 0) + (usage[vol.path].free || 0) || 1)"
                  size="sm"
                  :warnAt="75"
                  :dangerAt="90"
                  style="width:120px"
                  class="mb-1"
                />
                <div class="flex justify-between text-xs w-[120px]">
                  <span>{{ formatBytes(usage[vol.path].size || 0) }}</span>
                  <span>{{ formatBytes(usage[vol.path].total || 0) }}</span>
                </div>
              </template>
              <template v-else>
                <div class="mb-2 w-[120px] h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse"></div>
                <div class="flex justify-between text-xs w-[120px]">
                  <span class="h-3 w-10 rounded-sm bg-neutral-200 dark:bg-neutral-700 animate-pulse"></span>
                  <span class="h-3 w-10 rounded-sm bg-neutral-200 dark:bg-neutral-700 animate-pulse"></span>
                </div>
              </template>
            </template>
          </div>
        </button>
      </div>
      <div v-else class="text-sm text-neutral-500 dark:text-neutral-400">{{ $t('volumes.loading') }}</div>
    </section>
  </div>
</template>

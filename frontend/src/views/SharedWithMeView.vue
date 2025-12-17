<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { getSharedWithMe } from '@/api/shares.api';
import {
  ShareIcon,
  ClockIcon,
  LockClosedIcon,
  LockOpenIcon,
  UserIcon,
  MagnifyingGlassIcon,
  ArrowsUpDownIcon
} from '@heroicons/vue/24/outline';
import FileIcon from '@/icons/FileIcon.vue';

const { t } = useI18n();
const router = useRouter();
const shares = ref([]);
const loading = ref(false);
const error = ref('');
const searchQuery = ref('');
const filterMode = ref('active'); // 'active' | 'expired' | 'all'
const sortMode = ref('recent'); // 'recent' | 'label'

// Grid columns configuration
const GRID_COLS = 'grid-cols-[30px_minmax(0,3fr)_1.5fr_1fr_1.5fr]';

const loadShares = async () => {
  loading.value = true;
  error.value = '';

  try {
    const response = await getSharedWithMe();
    shares.value = response.shares || [];
  } catch (err) {
    console.error('Failed to load shared items:', err);
    error.value = err.message || t('errors.loadShares');
  } finally {
    loading.value = false;
  }
};

const getShareLabel = (share) => {
  if (share.label) {
    return share.label;
  }
  // Fallback to derived source name (leaf folder/file name)
  if (share.sourceName) {
    return share.sourceName;
  }
  return t('share.sharedItem');
};

const getIconItem = (share) => {
  let kind = 'file';
  if (share.isDirectory) {
    kind = 'directory';
  } else {
    const name = share.sourceName || '';
    const parts = name.split('.');
    if (parts.length > 1) {
      kind = parts.pop().toLowerCase();
    }
  }
  return {
    kind,
    name: getShareLabel(share),
    thumbnail: null,
    supportsThumbnail: false
  };
};

const formatDate = (dateString) => {
  if (!dateString) return t('common.noExpiration');
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

const isExpired = (share) => {
  if (!share.expiresAt) return false;
  return new Date(share.expiresAt) <= new Date();
};

const getRecentTimestamp = (share) => {
  if (!share) return 0;
  const fields = ['lastAccessedAt', 'updatedAt', 'createdAt'];
  for (const key of fields) {
    const raw = share[key];
    if (!raw) continue;
    const time = new Date(raw).getTime();
    if (!Number.isNaN(time)) return time;
  }
  return 0;
};

const visibleShares = computed(() => {
  let list = shares.value.slice();

  // Filter by active / expired
  if (filterMode.value === 'active') {
    list = list.filter((s) => !isExpired(s));
  } else if (filterMode.value === 'expired') {
    list = list.filter((s) => isExpired(s));
  }

  // Text search
  const term = searchQuery.value.trim().toLowerCase();
  if (term) {
    list = list.filter((share) => {
      const label = (getShareLabel(share) || '').toLowerCase();
      const sourceName = (share.sourceName || '').toLowerCase();
      return label.includes(term) || sourceName.includes(term);
    });
  }

  // Sorting
  list.sort((a, b) => {
    if (sortMode.value === 'label') {
      return getShareLabel(a).localeCompare(getShareLabel(b));
    }

    const timeA = getRecentTimestamp(a);
    const timeB = getRecentTimestamp(b);
    return timeB - timeA;
  });

  return list;
});

const handleOpenShare = (share) => {
  if (isExpired(share)) return;

  // Using named route with params ensures proper URL encoding
  router.push({
    name: 'FolderView',
    params: { path: `share/${share.shareToken}` }
  });
};

onMounted(async () => {
  await loadShares();
});
</script>

<template>
  <div class="h-full relative flex flex-col max-h-screen">
    <!-- Toolbar -->
    <div class="z-10 p-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-base">
      <div class="flex items-center gap-3">
        <!-- Title/Icon -->
        <div class="flex items-center gap-2 mr-4">
          <h1 class="font-medium text-neutral-800 dark:text-neutral-200 hidden sm:block text-lg ml-2">
            {{ t('share.sharedWithMe') }}
          </h1>
        </div>

        <!-- Filters -->
        <div class="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-md p-0.5">
          <button
            v-for="mode in ['active', 'expired', 'all']"
            :key="mode"
            @click="filterMode = mode"
            class="px-3 py-1 text-xs font-medium rounded-sm transition-colors"
            :class="filterMode === mode 
              ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm' 
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'"
          >
            {{ t(`common.${mode}`) }}
          </button>
        </div>

        <div class="h-6 w-px bg-neutral-200 dark:bg-neutral-700 mx-1"></div>

        <!-- Sort -->
        <div class="flex items-center gap-2">
          <button
            @click="sortMode = sortMode === 'recent' ? 'label' : 'recent'"
            class="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
            :title="t('actions.sortBy')"
          >
            <ArrowsUpDownIcon class="w-5 h-5" />
          </button>
        </div>

        <div class="flex-1"></div>

        <!-- Search -->
        <div class="relative">
          <MagnifyingGlassIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('share.filterByNameOrPath')"
            class="pl-9 pr-3 py-1.5 text-sm bg-neutral-100 dark:bg-neutral-800 rounded-md border-none focus:ring-2 focus:ring-blue-500 w-48 transition-all focus:w-64"
          />
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto px-2">
      <!-- Loading -->
      <div v-if="loading" class="flex h-full items-center justify-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="flex h-full flex-col items-center justify-center text-red-500">
        <p>{{ error }}</p>
        <button @click="loadShares" class="mt-2 text-blue-500 hover:underline">{{ t('common.tryAgain') }}</button>
      </div>

      <!-- Empty -->
      <div v-else-if="visibleShares.length === 0" class="flex h-full flex-col items-center justify-center text-neutral-400">
        <ShareIcon class="w-16 h-16 mb-4 opacity-20" />
        <p>{{ t('share.noSharedItemsToShow') }}</p>
      </div>

      <!-- List -->
      <div v-else class="min-w-[800px]">
        <!-- Header Row -->
        <div
          :class="['grid items-center gap-4 px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider border-b border-neutral-100 dark:border-neutral-800 sticky top-0 bg-white dark:bg-base z-10', GRID_COLS]"
        >
          <div></div>
          <div>{{ t('common.name') }}</div>
          <div>{{ t('share.sharedBy') }}</div>
          <div>{{ t('settings.access.title') }}</div>
          <div>{{ t('share.expiresAt') }}</div>
        </div>

        <!-- Items -->
        <div class="flex flex-col gap-0.5 pb-4">
          <div
            v-for="share in visibleShares"
            :key="share.id"
            @click="handleOpenShare(share)"
            :class="['grid items-center gap-4 px-4 py-2 text-sm rounded-md transition-colors group', GRID_COLS, 
              isExpired(share) 
                ? 'opacity-60 cursor-not-allowed bg-neutral-50 dark:bg-neutral-900/30' 
                : 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/50'
            ]"
          >
            <!-- Icon -->
            <div class="flex justify-center items-center">
              <FileIcon :item="getIconItem(share)" class="h-12 w-12 shrink-0" :disable-thumbnails="true" />
            </div>

            <!-- Name -->
            <div class="min-w-0">
              <div class="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                {{ getShareLabel(share) }}
              </div>
            </div>

            <!-- Shared By -->
            <div class="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
              <UserIcon class="w-4 h-4" />
              <span>{{ t('share.sharedBy') }}</span>
            </div>

            <!-- Access -->
            <div class="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
              <component
                :is="share.accessMode === 'readonly' ? LockClosedIcon : LockOpenIcon"
                class="w-4 h-4"
              />
              <span>
                {{ share.accessMode === 'readonly' ? t('settings.access.readOnly') : t('settings.access.readWrite') }}
              </span>
            </div>

            <!-- Expires -->
            <div class="text-neutral-600 dark:text-neutral-300">
              <span :class="{ 'text-red-500': isExpired(share) }">
                {{ share.expiresAt ? formatDate(share.expiresAt) : t('common.noExpiration') }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

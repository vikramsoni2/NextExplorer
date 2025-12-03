<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { getSharedWithMe } from '@/api/shares.api';
import {
  ShareIcon,
  FolderIcon,
  DocumentIcon,
  ClockIcon,
  LockClosedIcon,
  LockOpenIcon,
  UserIcon,
  ArrowRightIcon,
} from '@heroicons/vue/24/outline';

const { t } = useI18n();
const router = useRouter();
const shares = ref([]);
const loading = ref(false);
const error = ref('');
const searchQuery = ref('');
const filterMode = ref('active'); // 'active' | 'expired' | 'all'
const sortMode = ref('recent'); // 'recent' | 'label'

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

const formatDate = (dateString) => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

const isExpired = (share) => {
  if (!share.expiresAt) return false;
  return new Date(share.expiresAt) < new Date();
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

const summary = computed(() => {
  const total = shares.value.length;
  const expired = shares.value.filter((s) => isExpired(s)).length;
  const active = total - expired;
  return { total, active, expired };
});

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
  <div class="flex h-full flex-col gap-4 px-4 py-4 md:px-6 md:py-5">
    <!-- Header -->
    <header class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span
          class="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600
          dark:bg-blue-500/20 dark:text-blue-300"
        >
          <ShareIcon class="h-5 w-5" />
        </span>
        <div>
          <h1 class="text-base font-semibold text-neutral-900 dark:text-neutral-50">
            {{ t('share.sharedWithMe') }}
          </h1>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            {{ t('share.sharedWithMeDescription') }}
          </p>
        </div>
      </div>

      <div
        v-if="summary.total"
        class="hidden items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 sm:flex"
      >
        <span
          class="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1
          text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-blue-500" />
          <span class="font-medium">{{ summary.active }}</span>
          <span class="text-neutral-500 dark:text-neutral-400">{{ t('common.active').toLowerCase() }}</span>
        </span>
        <span
          v-if="summary.expired"
          class="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-red-700
          dark:bg-red-900/20 dark:text-red-300"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-red-500" />
          <span class="font-medium">{{ summary.expired }}</span>
          <span>{{ t('common.expired').toLowerCase() }}</span>
        </span>
      </div>
    </header>

    <!-- Content Card -->
    <section
      class="flex min-h-0 flex-1 flex-col rounded-xl border border-neutral-200 bg-white/80 shadow-sm backdrop-blur
      dark:border-neutral-800 dark:bg-neutral-900/60"
    >
      <!-- Toolbar -->
      <div
        class="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-3 py-2 text-xs
        dark:border-neutral-800"
      >
        <div
          class="inline-flex rounded-md bg-neutral-100 p-0.5 text-neutral-600
          dark:bg-neutral-800 dark:text-neutral-300"
        >
          <button
            type="button"
            class="rounded-[5px] px-2 py-1 transition"
            :class="filterMode === 'active'
              ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-900 dark:text-neutral-50'
              : 'hover:bg-neutral-200/70 dark:hover:bg-neutral-700/70'"
            @click="filterMode = 'active'"
          >
            {{ t('common.active') }}
          </button>
          <button
            type="button"
            class="rounded-[5px] px-2 py-1 transition"
            :class="filterMode === 'expired'
              ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-900 dark:text-neutral-50'
              : 'hover:bg-neutral-200/70 dark:hover:bg-neutral-700/70'"
            @click="filterMode = 'expired'"
          >
            {{ t('common.expired') }}
          </button>
          <button
            type="button"
            class="rounded-[5px] px-2 py-1 transition"
            :class="filterMode === 'all'
              ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-900 dark:text-neutral-50'
              : 'hover:bg-neutral-200/70 dark:hover:bg-neutral-700/70'"
            @click="filterMode = 'all'"
          >
            {{ t('common.all') }}
          </button>
        </div>

        <div class="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
          <span class="hidden sm:inline">{{ t('actions.sortBy') }}</span>
          <button
            type="button"
            class="rounded-md px-2 py-1 transition"
            :class="sortMode === 'recent'
              ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50'
              : 'hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80'"
            @click="sortMode = 'recent'"
          >
            {{ t('common.recent') }}
          </button>
          <button
            type="button"
            class="rounded-md px-2 py-1 transition"
            :class="sortMode === 'label'
              ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50'
              : 'hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80'"
            @click="sortMode = 'label'"
          >
            {{ t('common.name') }}
          </button>
        </div>

        <div class="ml-auto flex items-center gap-2">
          <div class="relative">
            <input
              v-model="searchQuery"
              type="search"
              class="w-44 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700
              placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
              dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              :placeholder="t('share.filterByNameOrPath')"
            />
          </div>

          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs
            text-neutral-700 hover:bg-neutral-100
            dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            @click="loadShares"
          >
            <span class="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
            <span>{{ t('common.refresh') }}</span>
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto">
        <!-- Loading State -->
        <div v-if="loading" class="flex h-full items-center justify-center py-12">
          <div class="text-center">
            <div
              class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-b-transparent"
            />
            <p class="text-sm text-neutral-600 dark:text-neutral-400">{{ t('loading.shares') }}</p>
          </div>
        </div>

        <!-- Error State -->
        <div
          v-else-if="error"
          class="flex h-full flex-col items-center justify-center px-6 py-10 text-center"
        >
          <div
            class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50
            text-red-600 dark:bg-red-900/20 dark:text-red-300"
          >
            <ShareIcon class="h-7 w-7" />
          </div>
          <h3 class="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            {{ t('errors.loadShares') }}
          </h3>
          <p class="mb-4 max-w-md text-xs text-neutral-600 dark:text-neutral-400">
            {{ error }}
          </p>
          <button
            type="button"
            class="rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-blue-700"
            @click="loadShares"
          >
            {{ t('common.tryAgain') }}
          </button>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="!visibleShares.length"
          class="flex h-full flex-col items-center justify-center px-6 py-10 text-center"
        >
          <div
            class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100
            text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500"
          >
            <ShareIcon class="h-8 w-8" />
          </div>
          <h3 class="mb-2 text-base font-medium text-neutral-900 dark:text-neutral-50">
            {{ t('share.noSharedItemsToShow') }}
          </h3>
          <p class="max-w-md text-xs text-neutral-600 dark:text-neutral-400">
            <span v-if="shares.length === 0">
              {{ t('share.noSharedItemsYet') }}
            </span>
            <span v-else>
              {{ t('share.adjustFilters') }}
            </span>
          </p>
        </div>

        <!-- Shares List -->
        <div
          v-else
          class="divide-y divide-neutral-200 dark:divide-neutral-800"
        >
          <button
            v-for="share in visibleShares"
            :key="share.id"
            type="button"
            class="group flex w-full items-center gap-4 px-4 py-3 text-left transition
            hover:bg-neutral-50 dark:hover:bg-neutral-800/70"
            :class="{
              'cursor-pointer': !isExpired(share),
              'opacity-60 cursor-not-allowed hover:bg-transparent dark:hover:bg-transparent': isExpired(share)
            }"
            @click="handleOpenShare(share)"
          >
            <!-- Icon -->
            <div
              class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
              :class="share.isDirectory
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'
                : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'"
            >
              <component
                :is="share.isDirectory ? FolderIcon : DocumentIcon"
                class="h-5 w-5"
              />
            </div>

            <!-- Main content -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="truncate text-sm font-medium text-neutral-900 dark:text-neutral-50">
                  {{ getShareLabel(share) }}
                </p>
                <span
                  v-if="isExpired(share)"
                  class="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700
                  dark:bg-red-900/50 dark:text-red-200"
                >
                  {{ t('share.expired') }}
                </span>
                <span
                  v-else
                  class="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700
                  dark:bg-green-900/40 dark:text-green-200"
                >
                  {{ t('share.active') }}
                </span>
              </div>

              <div
                class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]
                text-neutral-500 dark:text-neutral-400"
              >
                <span class="inline-flex items-center gap-1">
                  <UserIcon class="h-3.5 w-3.5" />
                  <span>{{ t('share.sharedBy') }}</span>
                </span>

                <span class="inline-flex items-center gap-1">
                  <component
                    :is="share.accessMode === 'readonly' ? LockClosedIcon : LockOpenIcon"
                    class="h-3.5 w-3.5"
                  />
                  <span>
                    {{ share.accessMode === 'readonly' ? t('settings.access.readOnly') : t('settings.access.readWrite') }}
                  </span>
                </span>

                <span class="inline-flex items-center gap-1">
                  <span class="h-1 w-1 rounded-full bg-neutral-400 dark:bg-neutral-500" />
                  <span>{{ share.isDirectory ? t('common.folder') : t('folder.kind') }}</span>
                </span>

                <span
                  v-if="share.expiresAt"
                  class="inline-flex items-center gap-1"
                >
                  <ClockIcon class="h-3.5 w-3.5" />
                  <span
                    :class="{
                      'text-red-600 dark:text-red-400': isExpired(share)
                    }"
                  >
                    {{ isExpired(share) ? t('common.expired') : t('share.expiresAt') }}
                    {{ formatDate(share.expiresAt) }}
                  </span>
                </span>
                <span
                  v-else
                  class="inline-flex items-center gap-1"
                >
                  <ClockIcon class="h-3.5 w-3.5" />
                  <span>{{ t('common.noExpiration') }}</span>
                </span>

                <span
                  v-if="share.lastAccessedAt || share.createdAt"
                  class="inline-flex items-center gap-1"
                >
                  <span class="h-1 w-1 rounded-full bg-neutral-400 dark:bg-neutral-500" />
                  <span>
                    <template v-if="share.lastAccessedAt">
                      {{ t('share.lastAccessed') }} {{ formatDate(share.lastAccessedAt) }}
                    </template>
                    <template v-else>
                      {{ t('share.created') }} {{ formatDate(share.createdAt) }}
                    </template>
                  </span>
                </span>
              </div>
            </div>

            <!-- Right side -->
            <!-- <div class="ml-4 flex flex-col items-end gap-1 text-xs">
              <p
                v-if="share.sourcePath"
                class="hidden max-w-[180px] truncate font-mono text-[10px] text-neutral-400 sm:block dark:text-neutral-500"
              >
                {{ share.sourcePath }}
              </p>

              <div
                v-if="!isExpired(share)"
                class="mt-auto hidden h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition
                group-hover:translate-x-0.5 group-hover:bg-blue-500 sm:flex"
              >
                <ArrowRightIcon class="h-4 w-4" />
              </div>
            </div> -->
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { getMyShares, deleteShare, copyShareUrl } from '@/api/shares.api';
import { fetchShareableUsers } from '@/api/users.api';
import {
  ShareIcon,
  ClockIcon,
  LockClosedIcon,
  LockOpenIcon,
  TrashIcon,
  GlobeAltIcon,
  UsersIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  ArrowsUpDownIcon,
} from '@heroicons/vue/24/outline';
import FileIcon from '@/icons/FileIcon.vue';

const { t } = useI18n();

const shares = ref([]);
const users = ref([]);
const loading = ref(false);
const error = ref('');
const deletingId = ref(null);
const copyingId = ref(null);
const copiedId = ref(null);
const searchQuery = ref('');
const filterMode = ref('active'); // 'active' | 'expired' | 'all'
const sortMode = ref('recent'); // 'recent' | 'label'

// Grid columns configuration
const GRID_COLS = 'grid-cols-[30px_minmax(0,3fr)_1.5fr_1fr_1.5fr_100px]';

// Create a map of userId -> user for quick lookup
const usersMap = computed(() => {
  const map = {};
  users.value.forEach((user) => {
    map[user.id] = user;
  });
  return map;
});

const loadShares = async () => {
  loading.value = true;
  error.value = '';

  try {
    const [sharesResponse, usersResponse] = await Promise.all([
      getMyShares(),
      fetchShareableUsers().catch(() => ({ users: [] })),
    ]);
    shares.value = sharesResponse?.shares || [];
    users.value = usersResponse?.users || [];
  } catch (err) {
    console.error('Failed to load my shares:', err);
    error.value = err.message || t('errors.loadShares');
  } finally {
    loading.value = false;
  }
};

// Get permitted users for a share
const getPermittedUsers = (share) => {
  if (!share.permittedUserIds || share.permittedUserIds.length === 0) {
    return [];
  }
  return share.permittedUserIds
    .map((userId) => usersMap.value[userId])
    .filter(Boolean); // Filter out any undefined users
};

const isExpired = (share) => {
  if (!share?.expiresAt) return false;
  return new Date(share.expiresAt) <= new Date();
};

const formatDate = (dateString) => {
  if (!dateString) return t('common.noExpiration');
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

const getRecentTimestamp = (share) => {
  if (!share) return 0;
  const fields = ['updatedAt', 'createdAt'];
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
      const sourcePath = (share.sourcePath || '').toLowerCase();
      return label.includes(term) || sourcePath.includes(term);
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

const getShareLabel = (share) => {
  if (share.label) return share.label;
  if (share.sourcePath) {
    const parts = share.sourcePath.split('/').filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return t('share.sharedItem');
};

const getIconItem = (share) => {
  let kind = 'file';
  if (share.isDirectory) {
    kind = 'directory';
  } else {
    const name = share.sourcePath || '';
    const parts = name.split('.');
    if (parts.length > 1) {
      kind = parts.pop().toLowerCase();
    }
  }
  return {
    kind,
    name: getShareLabel(share),
    thumbnail: null,
    supportsThumbnail: false,
  };
};

const handleDeleteShare = async (share) => {
  if (!share?.id) return;

  const confirmed = window.confirm(t('share.confirmDeleteShare'));
  if (!confirmed) return;

  deletingId.value = share.id;
  try {
    await deleteShare(share.id);
    shares.value = shares.value.filter((s) => s.id !== share.id);
  } catch (err) {
    console.error('Failed to delete share:', err);
    error.value = err.message || t('errors.deleteShare');
  } finally {
    deletingId.value = null;
  }
};

const handleCopyLink = async (share) => {
  if (!share?.id || !share?.shareToken) return;

  try {
    copyingId.value = share.id;
    await copyShareUrl(share.shareToken);
    copiedId.value = share.id;
    setTimeout(() => {
      if (copiedId.value === share.id) {
        copiedId.value = null;
      }
    }, 2000);
  } catch (err) {
    console.error('Failed to copy link:', err);
  } finally {
    copyingId.value = null;
  }
};

onMounted(async () => {
  await loadShares();
});
</script>

<template>
  <div class="h-full relative flex flex-col max-h-screen">
    <!-- Toolbar -->
    <div
      class="z-10 p-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-default"
    >
      <div class="flex items-center gap-3">
        <!-- Title/Icon -->
        <div class="flex items-center gap-2 mr-4">
          <h1
            class="font-medium text-neutral-800 dark:text-neutral-200 hidden sm:block text-lg ml-2"
          >
            {{ t('share.sharedByMe') }}
          </h1>
        </div>

        <!-- Filters -->
        <div
          class="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-md p-0.5"
        >
          <button
            v-for="mode in ['active', 'expired', 'all']"
            :key="mode"
            @click="filterMode = mode"
            class="px-3 py-1 text-xs font-medium rounded-sm transition-colors"
            :class="
              filterMode === mode
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
            "
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
          <MagnifyingGlassIcon
            class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"
          />
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
        <div
          class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"
        ></div>
      </div>

      <!-- Error -->
      <div
        v-else-if="error"
        class="flex h-full flex-col items-center justify-center text-red-500"
      >
        <p>{{ error }}</p>
        <button @click="loadShares" class="mt-2 text-blue-500 hover:underline">
          {{ t('common.tryAgain') }}
        </button>
      </div>

      <!-- Empty -->
      <div
        v-else-if="visibleShares.length === 0"
        class="flex h-full flex-col items-center justify-center text-neutral-400"
      >
        <ShareIcon class="w-16 h-16 mb-4 opacity-20" />
        <p>{{ t('share.noSharedItemsToShow') }}</p>
      </div>

      <!-- List -->
      <div v-else class="min-w-[800px]">
        <!-- Header Row -->
        <div
          :class="[
            'grid items-center gap-4 px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider border-b border-neutral-100 dark:border-neutral-800 sticky top-0 bg-white dark:bg-default z-10',
            GRID_COLS,
          ]"
        >
          <div></div>
          <div>{{ t('common.name') }}</div>
          <div>{{ t('share.sharedWith') }}</div>
          <div>{{ t('settings.access.title') }}</div>
          <div>{{ t('share.expiresAt') }}</div>
          <div class="text-right">{{ t('common.actions') }}</div>
        </div>

        <!-- Items -->
        <div class="flex flex-col gap-0.5 pb-4">
          <div
            v-for="share in visibleShares"
            :key="share.id"
            :class="[
              'grid items-center gap-4 px-4 py-2 text-sm rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-colors group',
              GRID_COLS,
            ]"
          >
            <!-- Icon -->
            <div class="flex justify-center items-center">
              <FileIcon
                :item="getIconItem(share)"
                class="w-12 h-12 shrink-0"
                :disable-thumbnails="true"
              />
            </div>

            <!-- Name & Path -->
            <div class="min-w-0">
              <div
                class="font-medium text-neutral-900 dark:text-neutral-100 truncate"
              >
                {{ getShareLabel(share) }}
              </div>
              <div class="text-xs text-neutral-400 truncate font-mono mt-0.5">
                {{ share.sourcePath }}
              </div>
            </div>

            <!-- Shared With -->
            <div class="min-w-0">
              <div
                v-if="share.sharingType === 'anyone'"
                class="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300"
              >
                <GlobeAltIcon class="w-4 h-4" />
                <span>{{ t('share.sharedWithAnyone') }}</span>
              </div>
              <div v-else class="flex flex-wrap gap-1">
                <div
                  v-for="user in getPermittedUsers(share).slice(0, 3)"
                  :key="user.id"
                  class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  {{ user.displayName || user.username }}
                </div>
                <span
                  v-if="getPermittedUsers(share).length > 3"
                  class="text-xs text-neutral-400"
                >
                  +{{ getPermittedUsers(share).length - 3 }}
                </span>
              </div>
            </div>

            <!-- Access -->
            <div
              class="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300"
            >
              <component
                :is="
                  share.accessMode === 'readonly'
                    ? LockClosedIcon
                    : LockOpenIcon
                "
                class="w-4 h-4"
              />
              <span>
                {{
                  share.accessMode === 'readonly'
                    ? t('settings.access.readOnly')
                    : t('settings.access.readWrite')
                }}
              </span>
            </div>

            <!-- Expires -->
            <div class="text-neutral-600 dark:text-neutral-300">
              <span :class="{ 'text-red-500': isExpired(share) }">
                {{
                  share.expiresAt
                    ? formatDate(share.expiresAt)
                    : t('common.noExpiration')
                }}
              </span>
            </div>

            <!-- Actions -->
            <div class="flex items-center justify-end gap-1">
              <button
                @click.stop="handleCopyLink(share)"
                class="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
                :title="t('actions.copy')"
              >
                <component
                  :is="
                    copiedId === share.id ? CheckIcon : ClipboardDocumentIcon
                  "
                  class="w-4 h-4"
                  :class="{ 'text-green-500': copiedId === share.id }"
                />
              </button>
              <button
                @click.stop="handleDeleteShare(share)"
                class="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-neutral-500 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400"
                :title="t('share.removeShare')"
              >
                <TrashIcon class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

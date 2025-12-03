<script setup>
import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { getMyShares, deleteShare } from '@/api/shares.api';
import { fetchUsers } from '@/api/users.api';
import {
  ShareIcon,
  FolderIcon,
  DocumentIcon,
  ClockIcon,
  LockClosedIcon,
  LockOpenIcon,
  TrashIcon,
  GlobeAltIcon,
  UsersIcon,
} from '@heroicons/vue/24/outline';

const { t } = useI18n();

const shares = ref([]);
const users = ref([]);
const loading = ref(false);
const error = ref('');
const deletingId = ref(null);

// Create a map of userId -> user for quick lookup
const usersMap = computed(() => {
  const map = {};
  users.value.forEach(user => {
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
      fetchUsers().catch(() => ({ users: [] })) // Non-admin users can't fetch users, so we'll handle it gracefully
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
    .map(userId => usersMap.value[userId])
    .filter(Boolean); // Filter out any undefined users
};

const hasShares = computed(() => shares.value.length > 0);

const isExpired = (share) => {
  if (!share?.expiresAt) return false;
  return new Date(share.expiresAt) < new Date();
};

const formatDate = (dateString) => {
  if (!dateString) return t('common.noExpiration');
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

const getShareLabel = (share) => {
  if (share.label) return share.label;
  if (share.sourcePath) {
    const parts = share.sourcePath.split('/').filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return t('share.sharedItem');
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
            {{ t('share.sharedByMe') }}
          </h1>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            {{ t('share.sharedByMeDescription') }}
          </p>
        </div>
      </div>

      <div
        v-if="hasShares"
        class="hidden items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 sm:flex"
      >
        <span
          class="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1
          text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-blue-500" />
          <span class="font-medium">{{ shares.length }}</span>
          <span class="text-neutral-500 dark:text-neutral-400">
            {{ shares.length === 1 ? t('common.item') : t('common.items') }}
          </span>
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
        class="flex items-center gap-2 border-b border-neutral-200 px-3 py-2 text-xs
        dark:border-neutral-800"
      >
        <span class="text-neutral-500 dark:text-neutral-400">
          {{ hasShares ? t('share.mySharesCount', { count: shares.length }) : t('share.noMyShares') }}
        </span>

        <div class="ml-auto flex items-center gap-2">
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
          v-else-if="!hasShares"
          class="flex h-full flex-col items-center justify-center px-6 py-10 text-center"
        >
          <div
            class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100
            text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500"
          >
            <ShareIcon class="h-8 w-8" />
          </div>
          <h3 class="mb-2 text-base font-medium text-neutral-900 dark:text-neutral-50">
            {{ t('share.noMyShares') }}
          </h3>
          <p class="max-w-md text-xs text-neutral-600 dark:text-neutral-400">
            {{ t('share.noMySharesDescription') }}
          </p>
        </div>

        <!-- Shares List -->
        <div
          v-else
          class="divide-y divide-neutral-200 dark:divide-neutral-800"
        >
          <div
            v-for="share in shares"
            :key="share.id"
            class="flex w-full items-center gap-4 px-4 py-3 text-left"
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
                  <span class="font-mono truncate max-w-[220px]">
                    {{ share.sourcePath }}
                  </span>
                </span>

                <!-- Sharing Type -->
                <span class="inline-flex items-center gap-1">
                  <component
                    :is="share.sharingType === 'anyone' ? GlobeAltIcon : UsersIcon"
                    class="h-3.5 w-3.5"
                  />
                  <span v-if="share.sharingType === 'anyone'">
                    {{ t('share.sharedWithAnyone') }}
                  </span>
                  <span v-else-if="share.sharingType === 'users'">
                    {{ t('share.sharedWithUsers', { count: share.permittedUserIds?.length || 0 }) }}
                  </span>
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
                  class="inline-flex items-center gap-1"
                >
                  <ClockIcon class="h-3.5 w-3.5" />
                  <span>
                    <template v-if="share.expiresAt">
                      {{ t('share.expiresAt') }} {{ formatDate(share.expiresAt) }}
                    </template>
                    <template v-else>
                      {{ t('common.noExpiration') }}
                    </template>
                  </span>
                </span>

                <span
                  v-if="share.createdAt"
                  class="inline-flex items-center gap-1"
                >
                  <span class="h-1 w-1 rounded-full bg-neutral-400 dark:bg-neutral-500" />
                  <span>
                    {{ t('share.created') }} {{ formatDate(share.createdAt) }}
                  </span>
                </span>
              </div>

              <!-- Permitted Users List (for user-specific shares) -->
              <div
                v-if="share.sharingType === 'users' && getPermittedUsers(share).length > 0"
                class="mt-2 flex flex-wrap items-center gap-1.5"
              >
                <span
                  v-for="user in getPermittedUsers(share)"
                  :key="user.id"
                  class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5
                  text-[10px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  <UsersIcon class="h-3 w-3" />
                  <span>{{ user.displayName || user.username || user.email }}</span>
                </span>
              </div>
            </div>

            <!-- Actions -->
            <div class="ml-4 flex flex-col items-end gap-1 text-xs">
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs
                text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-900/20"
                :disabled="deletingId === share.id"
                @click="handleDeleteShare(share)"
              >
                <TrashIcon class="h-3.5 w-3.5" />
                <span>
                  {{ deletingId === share.id ? t('common.deleting') : t('share.removeShare') }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>


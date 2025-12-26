<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { UserCircleIcon, KeyIcon, CloudIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  users: {
    type: Array,
    default: () => [],
  },
  loading: Boolean,
});

const emit = defineEmits(['select', 'create']);
const { t } = useI18n();

const getInitials = (name) => {
  return (name || 'U').substring(0, 2).toUpperCase();
};

const getAuthIcon = (method) => {
  if (method === 'local_password') return KeyIcon;
  if (method === 'oidc') return CloudIcon;
  return KeyIcon;
};

const getAuthLabel = (auth) => {
  if (auth.method === 'local_password') return 'Password';
  if (auth.method === 'oidc') return auth.provider || 'SSO';
  return auth.method;
};
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {{ t('titles.userManagement') }}
        </h2>
        <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Manage users, roles, and access credentials.
        </p>
      </div>
      <button
        @click="$emit('create')"
        class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-md hover:bg-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {{ t('settings.users.createUser') }}
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="animate-pulse text-zinc-400">
        {{ t('common.loading') }}...
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="users.length === 0"
      class="flex-1 flex flex-col items-center justify-center text-zinc-500"
    >
      <UserCircleIcon class="w-12 h-12 mb-2 opacity-50" />
      <p>{{ t('settings.users.noUsers') }}</p>
    </div>

    <!-- User List -->
    <div
      v-else
      class="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden"
    >
      <ul role="list" class="divide-y divide-zinc-200 dark:divide-zinc-800">
        <li
          v-for="user in users"
          :key="user.id"
          @click="$emit('select', user)"
          class="group relative flex items-center justify-between px-6 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors duration-150 ease-in-out"
        >
          <div class="flex items-center gap-4 min-w-0">
            <!-- Avatar -->
            <div class="shrink-0">
              <div
                class="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 font-medium text-sm"
              >
                {{
                  getInitials(user.displayName || user.username || user.email)
                }}
              </div>
            </div>

            <!-- User Info -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p
                  class="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate"
                >
                  {{ user.displayName || user.username }}
                </p>
                <span
                  v-if="(user.roles || []).includes('admin')"
                  class="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  Admin
                </span>
              </div>
              <p class="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                {{ user.email }}
              </p>
            </div>
          </div>

          <!-- Login Types -->
          <div class="flex items-center gap-3">
            <div class="flex -space-x-1 overflow-hidden">
              <div
                v-for="(auth, idx) in user.authMethods"
                :key="idx"
                class="relative inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 ring-2 ring-white dark:ring-zinc-900"
                :title="getAuthLabel(auth)"
              >
                <component
                  :is="getAuthIcon(auth.method)"
                  class="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400"
                />
              </div>
            </div>
            <div
              class="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
            >
              <svg
                class="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

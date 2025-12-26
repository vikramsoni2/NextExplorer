<script setup>
import { onMounted, computed } from 'vue';
import { useRouter, useRoute, RouterView } from 'vue-router';
import { useAppSettings } from '@/stores/appSettings';
import { useAuthStore } from '@/stores/auth';
import { useI18n } from 'vue-i18n';
import { XMarkIcon, Cog8ToothIcon } from '@heroicons/vue/24/outline';

const router = useRouter();
const route = useRoute();
const appSettings = useAppSettings();
const { t } = useI18n();
const auth = useAuthStore();

onMounted(() => {
  if (!appSettings.loaded && !appSettings.loading) {
    appSettings.load();
  }
});

const isAdmin = computed(
  () =>
    Array.isArray(auth.currentUser?.roles) &&
    auth.currentUser.roles.includes('admin'),
);
const isLocalUser = computed(() => auth.currentUser?.provider === 'local');

// User-facing settings
const userCategories = [
  {
    key: 'account-password',
    i18nKey: 'accountPassword',
    name: 'Change Password',
    icon: Cog8ToothIcon,
    requiresLocal: true,
  },
  { key: 'about', i18nKey: 'about', name: 'About', icon: Cog8ToothIcon },
  // Coming soon (user scope)
  // { key: 'general', name: 'General', icon: Cog8ToothIcon, comingSoon: true },
  // { key: 'appearance', name: 'Appearance', icon: Cog8ToothIcon, comingSoon: true },
];

// Admin-only settings
const adminCategories = [
  {
    key: 'files-thumbnails',
    i18nKey: 'filesThumbnails',
    name: 'Files & Thumbnails',
    icon: Cog8ToothIcon,
  },
  {
    key: 'access-control',
    i18nKey: 'accessControl',
    name: 'Access Control',
    icon: Cog8ToothIcon,
  },
  {
    key: 'admin-users',
    i18nKey: 'adminUsers',
    name: 'User Management',
    icon: Cog8ToothIcon,
  },
  // { key: 'admin-overview', name: 'Admin Overview', icon: Cog8ToothIcon, comingSoon: true },
  // { key: 'admin-mounts', name: 'Mounts & Shares', icon: Cog8ToothIcon, comingSoon: true },
  // { key: 'admin-audit', name: 'Audit & Events', icon: Cog8ToothIcon, comingSoon: true },
];

const isActive = (key) => {
  const path = route.path || '';
  if (path === '/settings' && key === 'about') return true;
  return path.endsWith(`/settings/${key}`);
};
const goCategory = (key) => router.push({ path: `/settings/${key}` });
const closeSettings = () => {
  const fallback = '/browse/';
  const prev =
    typeof route.query?.redirect === 'string' ? route.query.redirect : '';
  router.push(prev || fallback);
};
</script>

<template>
  <div class="flex h-full w-full flex-col">
    <!-- Header -->
    <header
      class="flex items-center gap-3 border-b border-neutral-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-neutral-700 dark:bg-neutral-800/80"
    >
      <div class="flex items-center gap-2">
        <span
          class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-300"
        >
          <Cog8ToothIcon class="h-5 w-5" />
        </span>
        <h1 class="text-base font-semibold text-neutral-900 dark:text-white">
          {{ t('titles.settings') }}
        </h1>
      </div>

      <button
        :title="t('common.close')"
        class="ml-auto inline-flex items-center justify-center rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700/70 dark:hover:text-white"
        @click="closeSettings"
      >
        <XMarkIcon class="h-5 w-5" />
      </button>
    </header>

    <!-- Body: responsive navigation + content -->
    <div class="flex flex-1 flex-col overflow-hidden md:flex-row">
      <!-- Categories navigation -->
      <aside
        class="border-b border-neutral-200 bg-neutral-50/80 px-4 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900/40 md:w-64 md:flex-shrink-0 md:border-b-0 md:border-r md:px-5 md:py-4"
      >
        <div class="mb-3 space-y-4">
          <section>
            <h2
              class="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400"
            >
              {{ t('common.user') }}
            </h2>
            <nav
              class="flex gap-2 overflow-x-auto pb-1 md:flex-col md:gap-1 md:overflow-visible md:pb-0"
            >
              <button
                v-for="c in userCategories.filter(
                  (c) => !c.requiresLocal || isLocalUser,
                )"
                :key="c.key"
                type="button"
                class="flex min-w-[160px] items-center gap-2 rounded-lg border border-neutral-200/70 bg-white/80 px-3 py-2 text-left text-sm text-neutral-700 shadow-sm transition hover:bg-white dark:border-neutral-700/70 dark:bg-neutral-800/80 dark:text-neutral-200 dark:hover:bg-neutral-700/80 md:min-w-0 md:w-full"
                :class="
                  isActive(c.key)
                    ? 'border-blue-500/70 bg-blue-50/80 text-blue-700 dark:border-blue-400/70 dark:bg-blue-500/10 dark:text-blue-200'
                    : ''
                "
                @click="goCategory(c.key)"
              >
                <component :is="c.icon" class="h-4 w-4 shrink-0" />
                <span class="truncate">{{
                  t('settings.categories.' + (c.i18nKey || c.key))
                }}</span>
              </button>
            </nav>
          </section>

          <section v-if="isAdmin">
            <h2
              class="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400"
            >
              {{ t('common.admin') }}
            </h2>
            <nav
              class="flex gap-2 overflow-x-auto pb-1 md:flex-col md:gap-1 md:overflow-visible md:pb-0"
            >
              <button
                v-for="c in adminCategories"
                :key="c.key"
                type="button"
                class="flex min-w-[160px] items-center gap-2 rounded-lg border border-neutral-200/70 bg-white/80 px-3 py-2 text-left text-sm text-neutral-700 shadow-sm transition hover:bg-white dark:border-neutral-700/70 dark:bg-neutral-800/80 dark:text-neutral-200 dark:hover:bg-neutral-700/80 md:min-w-0 md:w-full"
                :class="
                  isActive(c.key)
                    ? 'border-blue-500/70 bg-blue-50/80 text-blue-700 dark:border-blue-400/70 dark:bg-blue-500/10 dark:text-blue-200'
                    : ''
                "
                @click="goCategory(c.key)"
              >
                <component :is="c.icon" class="h-4 w-4 shrink-0" />
                <span class="truncate">{{
                  t('settings.categories.' + (c.i18nKey || c.key))
                }}</span>
              </button>
            </nav>
          </section>
        </div>
      </aside>

      <!-- Settings content -->
      <main class="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup>
import { onMounted, computed } from 'vue';
import { useRouter, useRoute, RouterView } from 'vue-router';
import { useAppSettings } from '@/stores/appSettings';
import { useAuthStore } from '@/stores/auth';
import HeaderLogo from '@/components/HeaderLogo.vue';
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

const isAdmin = computed(() => Array.isArray(auth.currentUser?.roles) && auth.currentUser.roles.includes('admin'));
const isLocalUser = computed(() => auth.currentUser?.provider === 'local');

// User-facing settings
const userCategories = [
  { key: 'account-password', name: 'Change Password', icon: Cog8ToothIcon, requiresLocal: true },
  { key: 'about', name: 'About', icon: Cog8ToothIcon },
  // Coming soon (user scope)
  // { key: 'general', name: 'General', icon: Cog8ToothIcon, comingSoon: true },
  // { key: 'appearance', name: 'Appearance', icon: Cog8ToothIcon, comingSoon: true },
];

// Admin-only settings
const adminCategories = [
  { key: 'files-thumbnails', name: 'Files & Thumbnails', icon: Cog8ToothIcon },
  { key: 'access-control', name: 'Access Control', icon: Cog8ToothIcon },
  { key: 'admin-users', name: 'User Management', icon: Cog8ToothIcon },
  // { key: 'admin-overview', name: 'Admin Overview', icon: Cog8ToothIcon, comingSoon: true },
  // { key: 'admin-mounts', name: 'Mounts & Shares', icon: Cog8ToothIcon, comingSoon: true },
  // { key: 'admin-audit', name: 'Audit & Events', icon: Cog8ToothIcon, comingSoon: true },
];

const isActive = (key) => route.path.endsWith(`/settings/${key}`);
const goCategory = (key) => router.push({ path: `/settings/${key}` });
const closeSettings = () => {
  const fallback = '/browse/';
  const prev = typeof route.query?.redirect === 'string' ? route.query.redirect : '';
  router.push(prev || fallback);
};
</script>

<template>
  <div class="relative flex w-full h-full">
    <aside class="w-[230px] bg-nextgray-100 dark:bg-zinc-800 dark:bg-opacity-70 p-6 px-5 shrink-0">
      <HeaderLogo />
      <div class="mt-4">
        <div class="mb-2 text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400">{{ t('settings.user') }}</div>
        <nav class="flex flex-col gap-1 mb-4">
          <button
            v-for="c in userCategories.filter(c => !c.requiresLocal || isLocalUser)"
            :key="c.key"
            class="flex items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-neutral-200/60 dark:hover:bg-zinc-700"
            :class="isActive(c.key) ? 'bg-neutral-200/80 dark:bg-zinc-700' : ''"
            @click="goCategory(c.key)"
          >
            <component :is="c.icon" class="w-5" />
            <span class="text-sm">{{ t('settings.categories.' + c.key) }}</span>
          </button>
        </nav>

        <template v-if="isAdmin">
          <div class="mb-2 text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400">{{ t('settings.admin') }}</div>
          <nav class="flex flex-col gap-1">
            <button
              v-for="c in adminCategories"
              :key="c.key"
              class="flex items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-neutral-200/60 dark:hover:bg-zinc-700"
              :class="isActive(c.key) ? 'bg-neutral-200/80 dark:bg-zinc-700' : ''"
              @click="goCategory(c.key)"
            >
              <component :is="c.icon" class="w-5" />
              <span class="text-sm">{{ t('settings.categories.' + c.key) }}</span>
            </button>
          </nav>
        </template>
      </div>
    </aside>

    <main class="flex flex-col grow dark:bg-opacity-95 dark:bg-zinc-800 shadow-lg">
      <div class="flex items-center p-6 py-4 shadow-md mb-4 dark:bg-nextgray-700 dark:bg-opacity-50">
        <div class="flex items-center gap-3 mr-auto">
          <Cog8ToothIcon class="w-6" />
          <h1 class="text-lg font-semibold">{{ t('settings.title') }}</h1>
        </div>

        <button
          :title="t('settings.close')"
          class="p-[6px] rounded-md dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
          @click="closeSettings"
        >
          <XMarkIcon class="w-6" />
        </button>
      </div>

      <div class="p-6 pt-0 overflow-y-auto grow">
        <RouterView />
      </div>
    </main>
  </div>
</template>

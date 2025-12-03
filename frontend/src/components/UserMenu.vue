<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useSettingsStore } from '@/stores/settings';
import { useAuthStore } from '@/stores/auth';
import { apiBase } from '@/api';
import {
  ArrowRightOnRectangleIcon,
  ChevronUpIcon,
  Cog8ToothIcon,
  UserCircleIcon,
} from '@heroicons/vue/24/outline';
import { SunIcon, MoonIcon } from '@heroicons/vue/24/outline';

const settings = useSettingsStore();
const auth = useAuthStore();
const router = useRouter();
const { t } = useI18n();

const isExpanded = ref(false);

const displayName = computed(() => auth.currentUser?.displayName || auth.currentUser?.username || t('user.account'));
const secondaryLabel = computed(() => {
  if (auth.currentUser?.email) {
    return auth.currentUser.email;
  }
  if (auth.currentUser?.username) {
    return auth.currentUser.username;
  }
  return '';
});

const avatarLetter = computed(() => {
  const source = auth.currentUser?.displayName || auth.currentUser?.username || '';
  return source ? source.trim().charAt(0).toUpperCase() : '';
});

const themeActionLabel = computed(() => (settings.isDark ? t('user.useLightTheme') : t('user.useDarkTheme')));
const themeStatusLabel = computed(() => (settings.isDark ? t('user.darkTheme') : t('user.lightTheme')));
const showSignOut = computed(() => auth.authEnabled !== false);

const toggleMenu = () => {
  isExpanded.value = !isExpanded.value;
};

const handleSettings = () => {
  isExpanded.value = false;
  router.push({ path: '/settings' });
};

const handleThemeToggle = () => {
  settings.toggleDark();
};

const handleLogout = async () => {
  // Capture whether the session is OIDC-backed before clearing state
  const wasOidcUser = auth.currentUser?.provider === 'oidc';

  // Always clear local session on the backend
  try { await auth.logout(); } catch (_) {}

  isExpanded.value = false;

  // If the current user was an OIDC user (or OIDC is enabled),
  // bounce through the provider-aware /logout endpoint to clear IdP session.
  const isOidcUser = wasOidcUser || auth.strategies?.oidc === true;
  if (isOidcUser) {
    const base = apiBase || '';
    const returnTo = '/auth/login';
    const logoutUrl = `${base}/logout?returnTo=${encodeURIComponent(returnTo)}`;
    window.location.href = logoutUrl;
    return;
  }

  router.push({ name: 'auth-login' });
};
</script>

<template>
  <div class="transition rounded-lg px-2 hover:bg-white dark:hover:bg-white/10 hover:shadow-md"
  :class="{ 'bg-white dark:bg-white/10 shadow-md': isExpanded}">

    <div class="flex flex-col py-2">
      <div class="rounded-xl text-sm text-neutral-800 dark:text-white  overflow-hidden">
        <transition 
          enter-active-class="transition-all duration-500" 
          leave-active-class="transition-all duration-500"
          enter-from-class="-mb-[100%]" 
          enter-to-class="mb-0" 
          leave-from-class="mb-0" 
          leave-to-class="-mb-[100%]">
          
          <div class="space-y-1 pb-3" v-if="isExpanded">
            <button
              class="flex w-full items-center gap-2 rounded-lg p-2 text-left text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
              type="button" @click="handleThemeToggle">
              <component :is="settings.isDark ? SunIcon : MoonIcon" class="h-5 w-5" />
              <div class="flex min-w-0 flex-col">
                <span class="text-sm font-semibold">{{ themeActionLabel }}</span>
                <span class="text-xs text-neutral-400 dark:text-white/50">{{ themeStatusLabel }}</span>
              </div>
            </button>

            <button
              class="flex w-full items-center gap-2 rounded-lg p-2 text-left text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
              type="button" @click="handleSettings">
              <Cog8ToothIcon class="h-5 w-5" />
              <span>{{ $t('common.settings') }}</span>
            </button>

            <button
              v-if="showSignOut"
              class="flex w-full items-center gap-2 rounded-lg p-2 text-left text-red-500 transition hover:bg-red-50 hover:text-red-600 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-200"
              type="button" @click="handleLogout">
              <ArrowRightOnRectangleIcon class="h-5 w-5" />
              <span>{{ $t('user.signOut') }}</span>
            </button>
          </div>
        </transition>
      </div>

      <div type="button" class="group flex w-full items-center gap-3 text-left transition" @click="toggleMenu"
        :aria-expanded="isExpanded">
        <span
          class="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-base font-semibold uppercase text-accent transition group-hover:bg-accent/25 dark:bg-white/10 dark:text-white dark:group-hover:bg-white/20">
          <template v-if="avatarLetter">{{ avatarLetter }}</template>
          <UserCircleIcon v-else class="h-6 w-6" />
        </span>
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="text-sm font-semibold text-neutral-900 dark:text-white">{{ displayName }}</span>
          <span v-if="secondaryLabel" class="text-xs text-neutral-500 dark:text-white/60 truncate">{{ secondaryLabel
            }}</span>
        </div>
        <ChevronUpIcon
          class="h-3 w-3 text-neutral-400 transition group-hover:text-neutral-700 dark:text-white/60 dark:group-hover:text-white/80"
          :class="{ 'rotate-180': isExpanded }" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSettingsStore } from '@/stores/settings';
import { useAuthStore } from '@/stores/auth';
import {
  ArrowRightOnRectangleIcon,
  ChevronUpDownIcon,
  Cog8ToothIcon,
  UserCircleIcon,
} from '@heroicons/vue/24/outline';

import { SunIcon, MoonIcon } from '@heroicons/vue/24/outline';

const settings = useSettingsStore();
const auth = useAuthStore();
const router = useRouter();

const isAccountMenuOpen = ref(false);
const avatarButtonRef = ref(null);
const menuRef = ref(null);

const displayName = computed(() => auth.currentUser?.displayName || auth.currentUser?.username || 'Account');
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

const closeMenu = () => {
  isAccountMenuOpen.value = false;
};

const toggleMenu = () => {
  isAccountMenuOpen.value = !isAccountMenuOpen.value;
};

const handleDocumentClick = (event) => {
  if (!isAccountMenuOpen.value) {
    return;
  }

  const path = event.composedPath ? event.composedPath() : event.path || [];
  if (
    (avatarButtonRef.value && path.includes(avatarButtonRef.value))
    || (menuRef.value && path.includes(menuRef.value))
  ) {
    return;
  }

  closeMenu();
};

onMounted(() => {
  document.addEventListener('click', handleDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick);
});

const handleSettings = () => {
  closeMenu();
  router.push({ path: '/settings' });
};

const themeActionLabel = computed(() => (settings.isDark ? 'Use light theme' : 'Use dark theme'));
const themeStatusLabel = computed(() => (settings.isDark ? 'Dark theme' : 'Light theme'));

const handleLogout = async () => {
  await auth.logout();
  closeMenu();
  router.push({ name: 'auth-login' });
};
</script>

<template>

  <div class="relative">
    
      <button
        ref="avatarButtonRef"
        title="Account"
        class="group w-full flex flex-1 items-center gap-3 rounded-lg px-2 py-1 text-left transition hover:bg-neutral-100 dark:hover:bg-white/10"
        @click.stop="toggleMenu"
      >
        <span
          class="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-base font-semibold uppercase text-accent transition group-hover:bg-accent/25 dark:bg-white/10 dark:text-white dark:group-hover:bg-white/20">
          <template v-if="avatarLetter">{{ avatarLetter }}</template>
          <UserCircleIcon v-else class="h-6 w-6" />
        </span>
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="text-sm font-semibold text-neutral-900 dark:text-white">{{ displayName }}</span>
          <span v-if="secondaryLabel" class="text-xs text-neutral-500 dark:text-white/60 truncate">{{ secondaryLabel }}</span>
        </div>
        <ChevronUpDownIcon class="h-5 w-5 text-neutral-400 transition group-hover:text-neutral-700 dark:text-white/40 dark:group-hover:text-white/70" />
      </button>
    

    <transition name="fade">
      <div
        v-if="isAccountMenuOpen"
        ref="menuRef"
        class="absolute bottom-full left-0 z-20 mb-3 w-full min-w-[220px] rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-800 shadow-xl shadow-black/10 backdrop-blur dark:border-white/10 dark:bg-nextzinc-900/95 dark:text-white"
      >
        <div class="mb-3 text-left px-2">
          <p class="text-base font-semibold text-neutral-900 dark:text-white">{{ displayName }}</p>
          <p v-if="secondaryLabel" class="text-xs text-neutral-500 dark:text-white/60 truncate">{{ secondaryLabel }}</p>
        </div>

        <div class="space-y-1">
          <button
            class="flex w-full items-center gap-2 rounded-lg p-2 text-left text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
            type="button"
            @click="settings.toggleDark()"
          >
            <component :is="settings.isDark ? SunIcon : MoonIcon" class="h-5 w-5" />
            <div class="flex min-w-0 flex-col">
              <span class="text-sm font-semibold">{{ themeActionLabel }}</span>
              <!-- <span class="text-xs text-neutral-400 dark:text-white/50">{{ themeStatusLabel }}</span> -->
            </div>
          </button>

          <button
            class="flex w-full items-center gap-2 rounded-lg p-2 text-left text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
            type="button"
            @click="handleSettings"
          >
            <Cog8ToothIcon class="h-5 w-5" />
            <span>Settings</span>
          </button>

          <button
            class="flex w-full items-center gap-2 rounded-lg p-2 text-left text-red-500 transition hover:bg-red-50 hover:text-red-600 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-200"
            type="button"
            @click="handleLogout"
          >
            <ArrowRightOnRectangleIcon class="h-5 w-5" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </transition>
  </div>

</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.fade-enter-to,
.fade-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>

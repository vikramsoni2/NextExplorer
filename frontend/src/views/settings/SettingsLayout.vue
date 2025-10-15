<script setup>
import { onMounted } from 'vue';
import { useRouter, useRoute, RouterView } from 'vue-router';
import { useAppSettings } from '@/stores/appSettings';
import HeaderLogo from '@/components/HeaderLogo.vue';
import { XMarkIcon, Cog8ToothIcon } from '@heroicons/vue/24/outline';

const router = useRouter();
const route = useRoute();
const appSettings = useAppSettings();

onMounted(() => {
  if (!appSettings.loaded && !appSettings.loading) {
    appSettings.load();
  }
});

const categories = [
  { key: 'files-thumbnails', name: 'Files & Thumbnails', icon: Cog8ToothIcon },
  { key: 'security', name: 'Security', icon: Cog8ToothIcon },
  { key: 'access-control', name: 'Access Control', icon: Cog8ToothIcon },
  // Coming soon
  { key: 'general', name: 'General', icon: Cog8ToothIcon, comingSoon: true },
  { key: 'appearance', name: 'Appearance', icon: Cog8ToothIcon, comingSoon: true },
  { key: 'uploads-downloads', name: 'Uploads & Downloads', icon: Cog8ToothIcon, comingSoon: true },
  { key: 'performance', name: 'Performance', icon: Cog8ToothIcon, comingSoon: true },
  { key: 'logging', name: 'Logging', icon: Cog8ToothIcon, comingSoon: true },
  { key: 'integrations', name: 'Integrations', icon: Cog8ToothIcon, comingSoon: true },
  { key: 'advanced', name: 'Advanced', icon: Cog8ToothIcon, comingSoon: true },
  { key: 'about', name: 'About', icon: Cog8ToothIcon },
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
        <div class="mb-2 text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Settings</div>
        <nav class="flex flex-col gap-1">
          <button
            v-for="c in categories"
            :key="c.key"
            class="flex items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-neutral-200/60 dark:hover:bg-zinc-700"
            :class="isActive(c.key) ? 'bg-neutral-200/80 dark:bg-zinc-700' : ''"
            @click="goCategory(c.key)"
          >
            <component :is="c.icon" class="w-5" />
            <span class="text-sm">{{ c.name }}</span>
            <!-- <span v-if="c.comingSoon" class="ml-auto text-[10px] rounded bg-white/20 px-2 py-0.5 text-white/80">Coming soon</span> -->
          </button>
        </nav>
      </div>
    </aside>

    <main class="flex flex-col grow dark:bg-opacity-95 dark:bg-zinc-800 shadow-lg">
      <div class="flex items-center p-6 py-4 shadow-md mb-4 dark:bg-nextgray-700 dark:bg-opacity-50">
        <div class="flex items-center gap-3 mr-auto">
          <Cog8ToothIcon class="w-6" />
          <h1 class="text-lg font-semibold">Settings</h1>
        </div>

        <button
          title="Close settings"
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

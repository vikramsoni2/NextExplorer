<script setup>
import { reactive, computed, watch } from 'vue';
import { useAppSettings } from '@/stores/appSettings';
import { useAuthStore } from '@/stores/auth';

const appSettings = useAppSettings();
const auth = useAuthStore();

const local = reactive({ authEnabled: true });
const original = computed(() => appSettings.state.security);
const dirty = computed(() => local.authEnabled !== original.value.authEnabled);

watch(
  () => appSettings.state.security,
  (s) => { local.authEnabled = s.authEnabled; },
  { immediate: true },
);

const reset = () => { local.authEnabled = original.value.authEnabled; };
const save = async () => {
  if (!local.authEnabled) {
    const ok = window.confirm('Disabling authentication will make your files publicly accessible. Continue?');
    if (!ok) return;
  }
  await appSettings.save({ security: { authEnabled: local.authEnabled } });
  // Sync auth store if needed
  auth.authEnabled = appSettings.state.security.authEnabled;
};
</script>

<template>
  <div class="space-y-6">
    <div v-if="dirty" class="sticky top-0 z-10 flex items-center justify-between rounded-md border border-yellow-400/30 bg-yellow-100/40 p-3 text-yellow-900 dark:border-yellow-400/20 dark:bg-yellow-500/10 dark:text-yellow-200">
      <div class="text-sm">You have unsaved changes</div>
      <div class="flex gap-2">
        <button class="rounded-md bg-yellow-500 px-3 py-1 text-black hover:bg-yellow-400" @click="save">Save</button>
        <button class="rounded-md border border-white/10 px-3 py-1 hover:bg-white/10" @click="reset">Discard</button>
      </div>
    </div>

    <section class="rounded-lg border border-white/10 bg-white/5 p-4 dark:bg-zinc-900/50">
      <h2 class="mb-2 text-base font-semibold">Authentication</h2>
      <p class="mb-4 text-sm text-neutral-500 dark:text-neutral-400">Control access to the app.</p>

      <div class="flex items-center justify-between py-2">
        <div>
          <div class="font-medium">Enable authentication</div>
          <div class="text-sm text-neutral-500 dark:text-neutral-400">When off, anyone can access your files.</div>
        </div>
        <label class="inline-flex cursor-pointer items-center">
          <input type="checkbox" v-model="local.authEnabled" class="peer sr-only" />
          <div class="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:mt-[2px] after:ml-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-full"></div>
        </label>
      </div>
    </section>
  </div>
</template>


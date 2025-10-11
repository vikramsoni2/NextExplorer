<script setup>
import { computed, reactive, watch } from 'vue';
import { useAppSettings } from '@/stores/appSettings';

const appSettings = useAppSettings();

const local = reactive({
  enabled: true,
  quality: 70,
  size: 200,
});

const original = computed(() => appSettings.state.thumbnails);
const dirty = computed(() => (
  local.enabled !== original.value.enabled ||
  local.quality !== original.value.quality ||
  local.size !== original.value.size
));

watch(
  () => appSettings.state.thumbnails,
  (t) => {
    local.enabled = t.enabled;
    local.quality = t.quality;
    local.size = t.size;
  },
  { immediate: true },
);

const reset = () => {
  const t = appSettings.state.thumbnails;
  local.enabled = t.enabled;
  local.quality = t.quality;
  local.size = t.size;
};

const save = async () => {
  await appSettings.save({ thumbnails: { enabled: local.enabled, quality: local.quality, size: local.size } });
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
      <h2 class="mb-2 text-base font-semibold">Thumbnails</h2>
      <p class="mb-4 text-sm text-neutral-500 dark:text-neutral-400">Customize preview thumbnails for images and videos.</p>

      <div class="flex items-center justify-between py-2">
        <div>
          <div class="font-medium">Enable thumbnails</div>
          <div class="text-sm text-neutral-500 dark:text-neutral-400">Turn off to speed up browsing without generating previews.</div>
        </div>
        <label class="inline-flex cursor-pointer items-center">
          <input type="checkbox" v-model="local.enabled" class="peer sr-only" />
          <div class="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:mt-[2px] after:ml-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-full"></div>
        </label>
      </div>

      <div class="flex items-center justify-between py-2" :class="{ 'opacity-60 pointer-events-none': !local.enabled }">
        <div>
          <div class="font-medium">Thumbnail quality</div>
          <div class="text-sm text-neutral-500 dark:text-neutral-400">Controls output quality (1–100). Default is 70.</div>
        </div>
        <div class="flex items-center gap-3">
          <input type="range" min="1" max="100" v-model.number="local.quality" class="w-64" />
          <input type="number" min="1" max="100" v-model.number="local.quality" class="w-16 rounded-md border border-white/10 bg-transparent px-2 py-1" />
        </div>
      </div>

      <div class="flex items-center justify-between py-2" :class="{ 'opacity-60 pointer-events-none': !local.enabled }">
        <div>
          <div class="font-medium">Max dimension</div>
          <div class="text-sm text-neutral-500 dark:text-neutral-400">Longest side in pixels. Default is 200.</div>
        </div>
        <div class="flex items-center gap-3">
          <input type="number" min="64" max="1024" step="1" v-model.number="local.size" class="w-24 rounded-md border border-white/10 bg-transparent px-2 py-1" />
        </div>
      </div>
    </section>
  </div>
</template>


<template>
  <div
    class="flex h-full w-full items-center justify-center bg-neutral-950 p-6"
  >
    <div
      class="w-full max-w-3xl rounded-xl bg-neutral-900/70 p-4 shadow-lg ring-1 ring-white/10"
    >
      <div class="mb-3 min-w-0">
        <p class="text-xs uppercase tracking-wide text-neutral-400">Audio</p>
        <h3 class="truncate text-base font-semibold text-white">
          {{ item?.name || '—' }}
        </h3>
      </div>

      <audio
        v-if="previewUrl"
        ref="audioRef"
        class="w-full"
        controls
        autoplay
        preload="metadata"
      >
        <source :src="previewUrl" :type="mimeType" />
        Your browser does not support the audio element.
      </audio>

      <div v-else class="text-sm text-neutral-300">Preview unavailable.</div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps({
  item: { type: Object, required: true },
  extension: { type: String, required: true },
  filePath: { type: String, required: true },
  previewUrl: { type: String, required: true },
  api: { type: Object, required: true },
});

const audioRef = ref(null);

const mimeType = computed(() => {
  const types = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    aac: 'audio/aac',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
    opus: 'audio/opus',
    wma: 'audio/x-ms-wma',
  };
  return types[props.extension] || 'audio/mpeg';
});

const cleanup = () => {
  if (!audioRef.value) return;
  try {
    audioRef.value.pause();
    audioRef.value.currentTime = 0;
  } catch {
    // ignore
  }
};

watch(() => props.previewUrl, cleanup);
onBeforeUnmount(cleanup);
</script>

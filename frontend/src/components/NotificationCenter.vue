<script setup>
import { computed, onMounted, ref } from 'vue';
import { useStorage } from '@vueuse/core';
import { XMarkIcon, InformationCircleIcon } from '@heroicons/vue/24/outline';
import { useFeaturesStore } from '@/stores/features';
import DOMPurify from 'dompurify';

// Local persistent state of dismissed announcement ids
const dismissed = useStorage('announcements:dismissedddd', {});

const announcements = ref([]);
const loading = ref(false);
const error = ref('');

const visibleAnnouncements = computed(() => {
  return (announcements.value || []).filter(a => !dismissed.value[a.id]);
});

function dismiss(id) {
  dismissed.value = { ...(dismissed.value || {}), [id]: true };
}

// Explicit class dictionary so Tailwind picks up all variants
const LEVEL_CLASSES = Object.freeze({
  info: 'bg-blue-50 text-blue-900 dark:bg-zinc-700 dark:text-white ring-1 ring-blue-200/60 dark:ring-blue-900/40',
  success: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100 ring-1 ring-emerald-200/60 dark:ring-emerald-900/40',
  warning: 'bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-100 ring-1 ring-amber-200/60 dark:ring-amber-900/40',
  error: 'bg-rose-50 text-rose-900 dark:bg-rose-900/20 dark:text-rose-100 ring-1 ring-rose-200/60 dark:ring-rose-900/40',
});

function safeHtml(input) {
  // Treat plain text newlines as paragraphs/line breaks for readability
  const text = String(input || '')
    .split('\n')
    .map(line => line.trim())
    .join('\n');
  const html = text
    .split(/\n\n+/)
    .map(p => `<p>${p.replaceAll('\n', '<br/>')}</p>`) 
    .join('');
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a'], ALLOWED_ATTR: ['href', 'target', 'rel'] });
}

onMounted(async () => {
  try {
    loading.value = true;
    const featuresStore = useFeaturesStore();
    await featuresStore.ensureLoaded();
    const anns = featuresStore.announcements || [];
    // normalize
    announcements.value = anns.map(a => ({
      id: String(a.id),
      level: a.level || 'info',
      title: a.title || '',
      message: a.message || '',
      once: Boolean(a.once),
    }));
  } catch (e) {
    error.value = e?.message || 'Failed to load announcements';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <!-- Fixed bottom-right popover stack -->
  <div
    v-if="visibleAnnouncements.length > 0"
    class="fixed bottom-4 right-4 z-1300 max-w-sm w-[min(92vw,22rem)] space-y-2 pointer-events-none"
  >
    <div
      v-for="a in visibleAnnouncements"
      :key="a.id"
      class="pointer-events-auto rounded-lg px-4 py-3 flex items-start gap-3 shadow-xl backdrop-blur-md"
      :class="LEVEL_CLASSES[a.level] || LEVEL_CLASSES.info"
    >
      <InformationCircleIcon class="w-5 h-5 mt-[2px] opacity-80" />
      <div class="flex-1">
        <div v-if="a.title" class="font-semibold mb-2">
          {{ a.title }}
        </div>
        <div class="text-sm leading-relaxed opacity-90 prose prose-sm dark:prose-invert max-w-none" v-html="safeHtml(a.message)" />
      </div>
      <button
        class="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
        title="Dismiss"
        @click="dismiss(a.id)"
      >
        <XMarkIcon class="w-5 h-5" />
      </button>
    </div>
  </div>
</template>

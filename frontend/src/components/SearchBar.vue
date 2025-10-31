<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/vue/24/outline';

const route = useRoute();
const router = useRouter();

const expanded = ref(false);
const term = ref('');
const inputRef = ref(null);

const currentPath = computed(() => {
  if (route.path.startsWith('/search')) {
    return typeof route.query.path === 'string' ? route.query.path : '';
  }
  return typeof route.params.path === 'string' ? route.params.path : '';
});

function toggleExpand() {
  if (!expanded.value) {
    expanded.value = true;
    nextTick(() => inputRef.value && inputRef.value.focus());
  } else if (term.value.trim()) {
    submit();
  } else {
    expanded.value = false;
  }
}

function clearTerm() {
  term.value = '';
  nextTick(() => inputRef.value && inputRef.value.focus());
}

function submit() {
  const q = term.value.trim();
  if (!q) {
    expanded.value = true;
    nextTick(() => inputRef.value && inputRef.value.focus());
    return;
  }
  router.push({ path: '/search', query: { q, path: currentPath.value || '' } });
}

watch(() => route.query.q, (v) => {
  if (typeof v === 'string') term.value = v;
});
</script>

<template>
  <div class="ml-3 flex items-center">
    <button class="p-2 rounded-md hover:bg-neutral-200 dark:hover:bg-zinc-700" @click="toggleExpand" title="Search">
      <MagnifyingGlassIcon class="h-5 w-5" />
    </button>
    <div v-show="expanded" class="relative">
      <input
        ref="inputRef"
        v-model="term"
        type="text"
        placeholder="Search"
        @keydown.enter.prevent="submit"
        @keydown.esc.prevent="expanded = !!term"
        class="ml-2 p-2 py-1 pl-3 pr-8 rounded-md dark:bg-zinc-700 outline-none border border-neutral-300 dark:border-zinc-600 w-64"
      />
      <button v-if="term" @click="clearTerm" class="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" title="Clear">
        <XMarkIcon class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>

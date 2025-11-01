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
  toggleExpand();
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
  <div class="flex items-center">
    <button
      class="p-[6px] pl-[7px] rounded-md hover:bg-[rgb(239,239,240)] active:bg-zinc-200 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      :class="expanded ? 'hidden' : 'block'"
      title="Open Search"
      @click="toggleExpand"
      >
      <MagnifyingGlassIcon class="w-[1.36rem]" />
    </button>

    <div
      :class="[
        'relative flex items-center overflow-hidden focus-within:border  bg-neutral-100 shadow-sm rounded-lg focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-400/40 dark:border-zinc-600 dark:bg-zinc-800 dark:focus-within:border-blue-400',

        expanded ? 'w-64' : 'w-0'
      ]"
      @click.stop
    >


      <MagnifyingGlassIcon class="mx-2 w-4 shrink-0" />
      <input
        ref="inputRef"
        v-model="term"
        v-show="expanded"
        type="text"
        placeholder="Search"
        @keydown.enter.prevent="submit"
        @keydown.esc.prevent="expanded = !!term"
        class="w-full bg-transparent py-1.5 pr-10 text-sm text-neutral-900 placeholder-neutral-500 outline-none dark:text-neutral-100 dark:placeholder-neutral-400
        transition-all duration-200 ease-in-out "
      />
      <button
        v-if="expanded"
        @click="clearTerm"
        class="mx-2 transition-colors duration-150 bg-zinc-400 dark:bg-zinc-600 text-white p-[2px] rounded-full focus:outline-none "
        title="Clear"
      >
        <XMarkIcon class="h-3 w-3" />
      </button>
    </div>
  </div>
</template>

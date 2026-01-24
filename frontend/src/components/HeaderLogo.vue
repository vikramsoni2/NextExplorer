<script setup>
import { computed } from 'vue';

const props = defineProps({
  appname: { type: String, default: 'Explorer' },
  logoUrl: { type: String, default: '/logo.svg' },
});

const logoSrc = computed(() => {
  const candidate = typeof props.logoUrl === 'string' ? props.logoUrl.trim() : '';
  return candidate || '/logo.svg';
});
</script>

<template>
  <router-link to="/" class="flex items-center gap-2 text-2xl font-bold">
    <img :src="logoSrc" class="h-10" :alt="props.appname + ' logo'" />

    <!-- <img src="/next.png" class="h-7 w-8" :alt="appname + ' logo'" /> -->

    {{ props.appname }}
  </router-link>
</template>

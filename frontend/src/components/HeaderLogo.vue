<script setup>
import { RouterLink } from 'vue-router';
const { appname } = defineProps({
  appname: { type: String, default: 'Explorer' },
});
</script>

<template>
  <router-link to="/" class="flex items-center gap-4 text-2xl font-bold">
    <img src="/next.png" class="h-7 w-8" :alt="appname + ' logo'" />
    {{ appname }}
  </router-link>
</template>

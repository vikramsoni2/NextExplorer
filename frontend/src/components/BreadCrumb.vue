<script setup>
import { computed } from 'vue';
import { ChevronRight16Filled } from '@vicons/fluent';
import { useRoute } from 'vue-router';
import { useNavigation } from '@/composables/navigation';

const { openBreadcrumb } = useNavigation();
const route = useRoute();

const paths = computed(() => {
  if (route.params.path) {
    const segments = route.params.path.split('/');
    const start = Math.max(0, segments.length - 3);
    return segments.slice(start).map((segment, index) => {
      return {
        name: segment,
        path: segments.slice(0, start + index + 1).join('/')
      };
    });
  }
  return [{ name: 'Volumes', path: ''}];
});
</script>

<template>
  <div class="flex items-center gap-3">
    <template v-for="(path, index) in paths" :key="index">
      <div v-if="index > 0" class="max-lg:hidden">
        <ChevronRight16Filled class="h-4 text-gray-500 dark:text-gray-400" />
      </div>
      <button 
        class="cursor-pointer line-clamp-1 text-ellipsis"
        :class="[index == paths.length -1? '' :'max-lg:hidden']"
        @click="openBreadcrumb(path.path)"
        >
          {{ path.name || 'Volumes' }}
      </button>
    </template>
  </div>
</template>

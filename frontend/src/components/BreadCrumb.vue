<script setup>
import { watch, ref } from 'vue';
import {ChevronRight16Filled} from '@vicons/fluent'
import { useRoute } from 'vue-router';
import {useNavigation} from '@/composables/navigation';


const {openBreadcrumb} = useNavigation()

const route = useRoute();
const paths = ref([])


watch(route, (to, from) => {
  if (to.params.path) {
    const segments = to.params.path.split('/');
    const start = Math.max(0, segments.length - 3);
    paths.value = segments.slice(start).map((segment, index) => {
      return {
        name: segment,
        // Construct the path up to the current segment
        path: segments.slice(0, start + index + 1).join('/')
      };
    });
  } else {
    paths.value = [];
  }
});


</script>
<template>
    <div class="flex items-center gap-3">
      <template v-if="paths[0]">
        <div class="cursor-pointer" @click="openBreadcrumb(paths[0].path)">{{ paths[0].name }}</div>
      </template>
      
      <template v-if="paths[1]">
      <ChevronRight16Filled class="h-4 text-gray-500"/>
      <div class="cursor-pointer" @click="openBreadcrumb(paths[1].path)">{{ paths[1].name }}</div>
      </template>

      <template v-if="paths[2]">
      <ChevronRight16Filled class="h-4 text-gray-500"/>
      <div class="cursor-pointer" @click="openBreadcrumb(paths[2].path)">{{ paths[2].name }}</div>
      </template>
      
    </div>
</template>
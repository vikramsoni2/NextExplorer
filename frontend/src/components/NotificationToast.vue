<script setup>
import {
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline';

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  heading: {
    type: String,
    required: true,
  },
  body: {
    type: String,
    default: '',
  },
  iconName: {
    type: String,
    default: 'InformationCircleIcon',
  },
  iconClass: {
    type: String,
    default: 'text-blue-500',
  },
});

const emit = defineEmits(['close']);

// Map icon names to components
const iconComponents = {
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
};

const iconComponent = iconComponents[props.iconName] || InformationCircleIcon;
</script>

<template>
  <div
    class="pointer-events-auto w-full max-w-sm overflow-hidden rounded-xl bg-white/95 dark:bg-zinc-900/90 shadow-2xl ring-1 ring-black/10 dark:ring-white/20 border border-neutral-200/80 dark:border-white/10 backdrop-blur-md"
  >
    <div class="p-4">
      <div class="flex items-start">
        <!-- Icon -->
        <div class="shrink-0">
          <component :is="iconComponent" class="h-6 w-6" :class="iconClass" />
        </div>

        <!-- Content -->
        <div class="ml-3 w-0 flex-1 pt-0.5">
          <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
            {{ heading }}
          </p>
          <p v-if="body" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {{ body }}
          </p>
        </div>

        <!-- Close button -->
        <div class="ml-4 flex shrink-0">
          <button
            type="button"
            @click="emit('close', id)"
            class="inline-flex rounded-md text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 dark:focus:ring-offset-zinc-800"
          >
            <span class="sr-only">{{ $t('common.dismiss') }}</span>
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

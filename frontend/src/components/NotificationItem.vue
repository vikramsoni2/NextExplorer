<script setup>
import { computed } from 'vue';
import {
  XMarkIcon,
  DocumentDuplicateIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

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
  timestamp: {
    type: String,
    required: true,
  },
  requestId: {
    type: String,
    default: '',
  },
  statusCode: {
    type: Number,
    default: null,
  },
  read: {
    type: Boolean,
    default: false,
  },
  iconName: {
    type: String,
    default: 'InformationCircleIcon',
  },
  iconClass: {
    type: String,
    default: 'text-blue-500',
  },
  borderClass: {
    type: String,
    default: 'border-blue-200 dark:border-blue-900/50',
  },
});

const emit = defineEmits(['copy', 'dismiss']);

// Map icon names to components
const iconComponents = {
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
};

const iconComponent = iconComponents[props.iconName] || InformationCircleIcon;

// Format timestamp
const formattedTime = computed(() => {
  try {
    return dayjs(props.timestamp).fromNow();
  } catch {
    return dayjs(props.timestamp).format('LLL');
  }
});
</script>

<template>
  <div
    class="rounded-lg border p-4 transition-colors duration-200"
    :class="[
      read ? 'bg-gray-50 dark:bg-zinc-800/50' : 'bg-white dark:bg-zinc-800',
      borderClass,
    ]"
  >
    <div class="flex items-start gap-3">
      <!-- Icon -->
      <component
        :is="iconComponent"
        class="h-5 w-5 shrink-0"
        :class="iconClass"
      />

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <p
          class="text-sm font-medium"
          :class="
            read
              ? 'text-gray-600 dark:text-gray-400'
              : 'text-gray-900 dark:text-gray-100'
          "
        >
          {{ heading }}
        </p>
        <p
          v-if="body"
          class="text-xs text-gray-500 dark:text-gray-400 mt-1 wrap-break-word"
        >
          {{ body }}
        </p>

        <!-- Metadata -->
        <div
          class="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500"
        >
          <span>{{ formattedTime }}</span>
          <span v-if="requestId" class="font-mono" :title="requestId">
            {{ requestId.slice(0, 8) }}...
          </span>
          <span v-if="statusCode" class="font-medium">
            {{ statusCode }}
          </span>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-1 shrink-0">
        <button
          @click="emit('copy', id)"
          title="Copy details"
          class="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 dark:focus:ring-offset-zinc-900 transition-colors duration-200"
        >
          <DocumentDuplicateIcon class="h-4 w-4" />
        </button>
        <button
          @click="emit('dismiss', id)"
          title="Dismiss"
          class="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 dark:focus:ring-offset-zinc-900 transition-colors duration-200"
        >
          <XMarkIcon class="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { onClickOutside } from '@vueuse/core';
import { TransitionRoot, TransitionChild } from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { useNotificationsStore } from '@/stores/notifications';
import NotificationItem from './NotificationItem.vue';

const notificationsStore = useNotificationsStore();
const { isPanelOpen, filteredNotifications, filters } =
  storeToRefs(notificationsStore);
const {
  closePanel,
  clearAll,
  toggleFilter,
  copyNotification,
  removeNotification,
} = notificationsStore;

// Filter chip data
const filterTypes = [
  {
    key: 'error',
    labelKey: 'notifications.filters.error',
    colorClass:
      'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-900/50',
  },
  {
    key: 'warning',
    labelKey: 'notifications.filters.warning',
    colorClass:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
  },
  {
    key: 'success',
    labelKey: 'notifications.filters.success',
    colorClass:
      'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-900/50',
  },
  {
    key: 'info',
    labelKey: 'notifications.filters.info',
    colorClass:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-900/50',
  },
];

// Reference to the panel element
const panelRef = ref(null);

function handleCopy(id) {
  copyNotification(id);
}

// Setup click outside listener with VueUse
onClickOutside(panelRef, () => {
  if (isPanelOpen.value) {
    closePanel();
  }
});
</script>

<template>
  <Teleport to="body">
    <TransitionRoot :show="isPanelOpen" as="template">
      <div class="relative z-50">
        <!-- Backdrop -->
        <TransitionChild
          enter="ease-in-out duration-300"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in-out duration-300"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div
            class="fixed inset-0 bg-black/30 dark:bg-black/50"
            @click="closePanel"
          />
        </TransitionChild>

        <!-- Panel -->
        <div class="fixed inset-0 overflow-hidden">
          <div class="absolute inset-0 overflow-hidden">
            <div
              class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10"
            >
              <TransitionChild
                enter="transform transition ease-in-out duration-300"
                enter-from="translate-x-full"
                enter-to="translate-x-0"
                leave="transform transition ease-in-out duration-300"
                leave-from="translate-x-0"
                leave-to="translate-x-full"
              >
                <div
                  ref="panelRef"
                  class="pointer-events-auto w-screen max-w-md h-screen"
                >
                  <div
                    class="flex h-full flex-col border-l bg-white/90 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/80"
                  >
                    <!-- Header -->
                    <div
                      class="px-4 py-6 border-b border-gray-200 dark:border-gray-700"
                    >
                      <div class="flex items-center justify-between mb-4">
                        <h2
                          class="text-lg font-semibold text-gray-900 dark:text-gray-100"
                        >
                          {{ $t('titles.notifications') }}
                        </h2>
                        <div class="flex items-center gap-3">
                          <button
                            v-if="filteredNotifications.length > 0"
                            @click="clearAll"
                            class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-hidden transition-colors duration-200"
                          >
                            {{ $t('actions.clearAll') }}
                          </button>
                          <button
                            @click="closePanel"
                            class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-hidden focus:ring-2 focus:ring-gray-400 dark:focus:ring-offset-zinc-900 rounded-lg p-1 transition-colors duration-200"
                          >
                            <span class="sr-only">{{
                              $t('notifications.closePanel')
                            }}</span>
                            <XMarkIcon class="h-6 w-6" />
                          </button>
                        </div>
                      </div>

                      <!-- Filter chips -->
                      <div class="flex flex-wrap gap-2">
                        <button
                          v-for="filter in filterTypes"
                          :key="filter.key"
                          @click="toggleFilter(filter.key)"
                          class="px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200"
                          :class="[
                            filters[filter.key]
                              ? filter.colorClass
                              : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 opacity-50 hover:opacity-75',
                          ]"
                        >
                          {{ $t(filter.labelKey) }}
                        </button>
                      </div>
                    </div>

                    <!-- Notification list -->
                    <div class="flex-1 overflow-y-auto px-4 py-4">
                      <div
                        v-if="filteredNotifications.length === 0"
                        class="text-center py-12"
                      >
                        <p class="text-gray-500 dark:text-gray-400">
                          {{ $t('notifications.empty') }}
                        </p>
                      </div>

                      <div v-else class="space-y-3">
                        <NotificationItem
                          v-for="notification in filteredNotifications"
                          :key="notification.id"
                          v-bind="notification"
                          @copy="handleCopy"
                          @dismiss="removeNotification"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TransitionChild>
            </div>
          </div>
        </div>
      </div>
    </TransitionRoot>
  </Teleport>
</template>

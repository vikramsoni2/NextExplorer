<script setup>
import { storeToRefs } from 'pinia'
import { useNotificationsStore } from '@/stores/notifications'
import NotificationToast from './NotificationToast.vue'

const notificationsStore = useNotificationsStore()
const { activeToasts } = storeToRefs(notificationsStore)
const { dismissToast } = notificationsStore
</script>

<template>
  <!-- Fixed toast container at bottom-right -->
  <div
    aria-live="assertive"
    class="pointer-events-none fixed inset-0 flex items-end px-4 py-6 sm:p-6 z-50">
    <div class="flex w-full flex-col items-center space-y-4 sm:items-end">
      <TransitionGroup
        enter-active-class="transform ease-out duration-300 transition"
        enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
        enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
        leave-active-class="transition ease-in duration-100"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0">
        <NotificationToast
          v-for="notification in activeToasts"
          :key="notification.id"
          v-bind="notification"
          @close="dismissToast" />
      </TransitionGroup>
    </div>
  </div>
</template>

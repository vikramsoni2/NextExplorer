<script setup>
import { storeToRefs } from 'pinia'
import { BellIcon } from '@heroicons/vue/24/outline'
import { useNotificationsStore } from '@/stores/notifications'

const notificationsStore = useNotificationsStore()
const { unreadCount } = storeToRefs(notificationsStore)
const { togglePanel } = notificationsStore
</script>

<template>
  <button
    @click="togglePanel"
    class="relative p-[6px] text-zinc-600 dark:text-zinc-300
           hover:text-zinc-900 dark:hover:text-white rounded-lg
           hover:bg-zinc-100 dark:hover:bg-zinc-700
           focus:outline-none focus:ring-2 focus:ring-offset-2
           focus:ring-zinc-400 dark:focus:ring-offset-zinc-900
           transition-colors duration-200"
    :aria-label="$t('notifications.open')">
    <BellIcon class="w-6" />

    <!-- Badge with count and pulse animation -->
    <span
      v-if="unreadCount > 0"
      class="absolute top-0 right-0 flex h-5 w-5">
      <!-- Ping animation -->
      <span
        class="animate-ping absolute inline-flex h-full w-full
               rounded-full bg-red-400 opacity-75"></span>
      <!-- Badge -->
      <span
        class="relative inline-flex items-center justify-center
               rounded-full h-5 w-5 bg-red-500 text-xs text-white font-medium">
        {{ unreadCount > 9 ? '9+' : unreadCount }}
      </span>
    </span>
  </button>
</template>

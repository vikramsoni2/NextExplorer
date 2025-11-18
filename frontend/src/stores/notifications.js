import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useStorage } from '@vueuse/core'

// Icon mapping for notification types
const ICON_MAP = {
  error: { name: 'XCircleIcon', class: 'text-red-500 dark:text-red-400' },
  success: { name: 'CheckCircleIcon', class: 'text-green-500 dark:text-green-400' },
  info: { name: 'InformationCircleIcon', class: 'text-blue-500 dark:text-blue-400' },
  warning: { name: 'ExclamationTriangleIcon', class: 'text-amber-500 dark:text-amber-400' }
}

const BORDER_MAP = {
  error: 'border-red-200 dark:border-red-900/50',
  success: 'border-green-200 dark:border-green-900/50',
  info: 'border-blue-200 dark:border-blue-900/50',
  warning: 'border-amber-200 dark:border-amber-900/50'
}

// Default durations
const DEFAULT_DURATION = {
  error: 5000,
  success: 3000,
  info: 4000,
  warning: 4000
}

// Maximum notifications to keep
const MAX_NOTIFICATIONS = 100
const MAX_AGE_DAYS = 7

export const useNotificationsStore = defineStore('notifications', () => {
  // State with localStorage persistence
  const notifications = useStorage('nextexplorer:notifications', [])
  const isPanelOpen = ref(false)
  const filters = useStorage('nextexplorer:notification-filters', {
    error: true,
    success: true,
    info: true,
    warning: true
  })

  // Active timers for auto-dismiss
  const dismissTimers = ref(new Map())

  // Computed
  const unreadCount = computed(() => {
    return notifications.value.filter(n => !n.read).length
  })

  const filteredNotifications = computed(() => {
    return notifications.value.filter(n => filters.value[n.type])
  })

  const activeToasts = computed(() => {
    // Show only recent unread notifications as toasts
    const now = Date.now()
    return notifications.value
      .filter(n => {
        // Show toasts that are less than their duration old and match filters
        if (!filters.value[n.type]) return false
        if (n.toastDismissed) return false
        const age = now - new Date(n.timestamp).getTime()
        const duration = n.durationMs || DEFAULT_DURATION[n.type]
        return age < duration
      })
      .slice(-5) // Max 5 toasts at once
  })

  // Generate unique ID
  function generateId() {
    return Math.random().toString(36).substr(2, 9) + new Date().getTime().toString(36)
  }

  // Add notification
  function addNotification(notification) {
    const { type = 'info', heading, body, requestId, statusCode, durationMs, details } = notification

    const id = generateId()
    const timestamp = new Date().toISOString()
    const icon = ICON_MAP[type] || ICON_MAP.info
    const duration = durationMs !== undefined ? durationMs : DEFAULT_DURATION[type]

    const newNotification = {
      id,
      type,
      heading,
      body,
      timestamp,
      requestId,
      statusCode,
      details,
      durationMs: duration,
      read: false,
      iconName: icon.name,
      iconClass: icon.class,
      borderClass: BORDER_MAP[type],
      toastDismissed: false
    }

    // Add to array
    notifications.value.push(newNotification)

    // Prune old notifications if over limit
    if (notifications.value.length > MAX_NOTIFICATIONS) {
      notifications.value = notifications.value.slice(-MAX_NOTIFICATIONS)
    }

    // Note: We don't auto-remove notifications - they persist in the panel
    // The activeToasts computed handles showing/hiding toasts based on age

    return id
  }

  // Remove notification
  function removeNotification(id) {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }

    // Clear timer if exists
    if (dismissTimers.value.has(id)) {
      clearTimeout(dismissTimers.value.get(id))
      dismissTimers.value.delete(id)
    }
  }

  // Dismiss toast but keep notification in panel
  function dismissToast(id) {
    const notification = notifications.value.find(n => n.id === id)
    if (notification) {
      notification.toastDismissed = true
    }
  }

  // Mark as read
  function markAsRead(id) {
    const notification = notifications.value.find(n => n.id === id)
    if (notification) {
      notification.read = true
    }
  }

  // Mark all as read
  function markAllAsRead() {
    notifications.value.forEach(n => {
      n.read = true
    })
  }

  // Clear all notifications
  function clearAll() {
    // Clear all timers
    dismissTimers.value.forEach(timer => clearTimeout(timer))
    dismissTimers.value.clear()

    notifications.value = []
  }

  // Toggle panel
  function togglePanel() {
    isPanelOpen.value = !isPanelOpen.value
    if (isPanelOpen.value) {
      // Mark all as read when opening panel
      markAllAsRead()
    }
  }

  // Close panel
  function closePanel() {
    isPanelOpen.value = false
  }

  // Set filter
  function setFilter(type, enabled) {
    filters.value[type] = enabled
  }

  // Toggle filter
  function toggleFilter(type) {
    filters.value[type] = !filters.value[type]
  }

  // Prune old notifications
  function pruneOld() {
    const maxAge = MAX_AGE_DAYS * 24 * 60 * 60 * 1000
    const now = Date.now()

    notifications.value = notifications.value.filter(n => {
      const age = now - new Date(n.timestamp).getTime()
      return age < maxAge
    })
  }

  // Copy notification details
  async function copyNotification(id) {
    const notification = notifications.value.find(n => n.id === id)
    if (!notification) return false

    const text = `Error: ${notification.heading}
${notification.body ? `Details: ${notification.body}\n` : ''}Request ID: ${notification.requestId || 'N/A'}
Status Code: ${notification.statusCode || 'N/A'}
Time: ${notification.timestamp}`

    try {
      await navigator.clipboard.writeText(text)

      // Show success toast
      addNotification({
        type: 'success',
        heading: 'Copied to clipboard',
        durationMs: 2000
      })

      return true
    } catch (error) {
      console.error('Failed to copy:', error)
      return false
    }
  }

  // Initialize - prune old notifications on load
  pruneOld()

  return {
    // State
    notifications,
    isPanelOpen,
    filters,

    // Computed
    unreadCount,
    filteredNotifications,
    activeToasts,

    // Actions
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    togglePanel,
    closePanel,
    setFilter,
    toggleFilter,
    pruneOld,
    copyNotification,
    dismissToast
  }
})

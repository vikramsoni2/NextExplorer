<script setup>
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import {
  Cog8ToothIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/vue/24/outline'

import { SunIcon, MoonIcon } from '@heroicons/vue/24/outline'

const settings = useSettingsStore()
const auth = useAuthStore()
const router = useRouter()

const handleLogout = async () => {
  await auth.logout()
  router.push({ name: 'auth-login' })
}



</script>

<template>

  <div class="flex gap-1 items-center">

    <button title="toggle dark mode" @click="settings.toggleDark()"
      class="p-[6px] rounded-md dark:hover:bg-zinc-700 dark:active:bg-zinc-600">
      <SunIcon class="w-6" v-if="settings.isDark" />
      <MoonIcon class="w-6" v-else />
    </button>

    <button
      title="settings"
      class="p-[6px] rounded-md dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      @click="router.push({ path: '/settings' })"
    >
      <Cog8ToothIcon class="w-6" />
    </button>

    <button
      title="sign out"
      class="p-[6px] rounded-md dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      @click="handleLogout"
    >
      <ArrowRightOnRectangleIcon class="w-6" />
    </button>

    

  </div>

</template>

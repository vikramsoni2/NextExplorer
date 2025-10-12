<script setup>
/* global __APP_VERSION__ */
// __APP_VERSION__ is injected at build time via Vite define
// See: frontend/vite.config.js
const version = __APP_VERSION__
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-lg border border-white/10 bg-white/5 p-4 dark:bg-zinc-900/50">
      <h2 class="mb-2 text-base font-semibold">About</h2>
      <p class="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
        View build information for this application.
      </p>

      <div class="flex items-center justify-between py-2">
        <div>
          <div class="font-medium">App version</div>
          <div class="text-sm text-neutral-500 dark:text-neutral-400">The build version currently running.</div>
        </div>
        <div class="rounded-md border border-white/10 bg-transparent px-3 py-1 text-sm">
          <span>v{{ version }}</span>
        </div>
      </div>
    </section>
  </div>
  
</template>

<script setup>
/* global __APP_VERSION__, __GIT_COMMIT__, __GIT_BRANCH__, __REPO_URL__ */
// Build-time constants are injected via Vite define (see: frontend/vite.config.js)
const version = __APP_VERSION__
const gitCommit = typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : ''
const gitBranch = typeof __GIT_BRANCH__ !== 'undefined' ? __GIT_BRANCH__ : ''
const repoUrl = typeof __REPO_URL__ !== 'undefined' ? __REPO_URL__ : ''
const commitShort = gitCommit ? gitCommit.slice(0, 7) : ''
const commitUrl = repoUrl && gitCommit ? `${repoUrl}/commit/${gitCommit}` : ''
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-lg   p-4">
      <h2 class="mb-2 text-base font-semibold">{{ t('settings.about.title') }}</h2>
      <p class="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
        {{ t('settings.about.subtitle') }}
      </p>

      <div class="flex items-center justify-between py-2">
        <div>
          <div class="font-medium">{{ t('settings.about.appVersion') }}</div>
          <div class="text-sm text-neutral-500 dark:text-neutral-400">{{ t('settings.about.appVersionHelp') }}</div>
        </div>
        <div class="rounded-md border border-white/10 bg-transparent px-3 py-1 text-sm">
          <span>v{{ version }}</span>
        </div>
      </div>

      <div class="flex items-center justify-between py-2">
        <div>
          <div class="font-medium">{{ t('settings.about.gitCommit') }}</div>
          <div class="text-sm text-neutral-500 dark:text-neutral-400">{{ t('settings.about.gitCommitHelp') }}</div>
        </div>
        <div class="rounded-md border border-white/10 bg-transparent px-3 py-1 text-sm">
          <template v-if="commitShort">
            <a v-if="commitUrl" :href="commitUrl" target="_blank" rel="noopener noreferrer" class="underline decoration-dotted underline-offset-4">
              {{ commitShort }}
            </a>
            <span v-else>{{ commitShort }}</span>
          </template>
          <span v-else class="text-neutral-500">{{ t('settings.about.unknown') }}</span>
        </div>
      </div>

      <div class="flex items-center justify-between py-2">
        <div>
          <div class="font-medium">{{ t('settings.about.branch') }}</div>
          <div class="text-sm text-neutral-500 dark:text-neutral-400">{{ t('settings.about.branchHelp') }}</div>
        </div>
        <div class="rounded-md border border-white/10 bg-transparent px-3 py-1 text-sm">
          <span v-if="gitBranch">{{ gitBranch }}</span>
          <span v-else class="text-neutral-500">{{ t('settings.about.unknown') }}</span>
        </div>
      </div>
    </section>
  </div>
  
</template>

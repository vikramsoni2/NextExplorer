<script setup>
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFeaturesStore } from '@/stores/features';

const { t } = useI18n();
const featuresStore = useFeaturesStore();

const commitShort = computed(() => {
  const commit = featuresStore.gitCommit;
  return commit ? commit.slice(0, 7) : '';
});

const commitUrl = computed(() => {
  const repo = featuresStore.repoUrl;
  const commit = featuresStore.gitCommit;
  return repo && commit ? `${repo}/commit/${commit}` : '';
});

onMounted(async () => {
  try {
    await featuresStore.ensureLoaded();
  } catch (_) {
    // Non-fatal; version info is optional
  }
});
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-lg p-4">
      <h2 class="mb-2 text-base font-semibold">{{ t('titles.about') }}</h2>
      <p class="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
        {{ t('settings.about.subtitle') }}
      </p>

      <div class="flex items-center justify-between py-2">
        <div>
          <div class="font-medium">{{ t('settings.about.appVersion') }}</div>
          <div class="text-sm text-neutral-500 dark:text-neutral-400">
            {{ t('settings.about.appVersionHelp') }}
          </div>
        </div>
        <div
          class="rounded-md border border-white/10 bg-transparent px-3 py-1 text-sm"
        >
          <span>v{{ featuresStore.version }}</span>
        </div>
      </div>

      <div class="flex items-center justify-between py-2">
        <div>
          <div class="font-medium">{{ t('settings.about.gitCommit') }}</div>
          <div class="text-sm text-neutral-500 dark:text-neutral-400">
            {{ t('settings.about.gitCommitHelp') }}
          </div>
        </div>
        <div
          class="rounded-md border border-white/10 bg-transparent px-3 py-1 text-sm"
        >
          <template v-if="commitShort">
            <a
              v-if="commitUrl"
              :href="commitUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="underline decoration-dotted underline-offset-4"
            >
              {{ commitShort }}
            </a>
            <span v-else>{{ commitShort }}</span>
          </template>
          <span v-else class="text-neutral-500">{{ t('common.unknown') }}</span>
        </div>
      </div>

      <div class="flex items-center justify-between py-2">
        <div>
          <div class="font-medium">{{ t('settings.about.branch') }}</div>
          <div class="text-sm text-neutral-500 dark:text-neutral-400">
            {{ t('settings.about.branchHelp') }}
          </div>
        </div>
        <div
          class="rounded-md border border-white/10 bg-transparent px-3 py-1 text-sm"
        >
          <span v-if="featuresStore.gitBranch">{{
            featuresStore.gitBranch
          }}</span>
          <span v-else class="text-neutral-500">{{ t('common.unknown') }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

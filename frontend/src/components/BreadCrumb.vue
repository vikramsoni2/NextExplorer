<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronRight16Filled } from '@vicons/fluent';
import { useRoute } from 'vue-router';
import { useNavigation } from '@/composables/navigation';
import { useFileStore } from '@/stores/fileStore';
import { ellipses } from '@/utils/ellipses';

const { openBreadcrumb } = useNavigation();
const { t, te } = useI18n();
const route = useRoute();
const fileStore = useFileStore();

const paths = computed(() => {
  if (route.params.path) {
    const segments = String(route.params.path).split('/');

    // Special handling for share paths
    if (segments[0] === 'share' && segments.length >= 2) {
      const shareToken = segments[1];
      const shareInfo = fileStore.currentPathData?.shareInfo;

      // Display priority: label > sourceFolderName > token
      const shareDisplayName =
        shareInfo?.label?.trim() ||
        shareInfo?.sourceFolderName?.trim() ||
        shareToken;

      const breadcrumbs = [
        { name: t('breadcrumb.share', 'Share'), path: 'share' },
        { name: ellipses(shareDisplayName, 28), path: `share/${shareToken}` },
      ];

      // Add inner path segments (show last 2)
      if (segments.length > 2) {
        const innerSegments = segments.slice(2);
        const start = Math.max(0, innerSegments.length - 2);
        for (let i = start; i < innerSegments.length; i++) {
          breadcrumbs.push({
            name: ellipses(innerSegments[i], 28),
            path: segments.slice(0, 3 + i).join('/'),
          });
        }
      }

      return breadcrumbs;
    }

    // Default handling for non-share paths
    const start = Math.max(0, segments.length - 3);
    return segments.slice(start).map((segment, index) => {
      const absoluteIndex = start + index;
      const displayName =
        absoluteIndex === 0 && te(`drives.${segment}`)
          ? t(`drives.${segment}`)
          : segment;

      return {
        name: ellipses(displayName, 28),
        path: segments.slice(0, start + index + 1).join('/'),
      };
    });
  }
  return [{ name: t('breadcrumb.volumes'), path: '' }];
});
</script>

<template>
  <div class="flex items-center gap-3">
    <template v-for="(path, index) in paths" :key="index">
      <div v-if="index > 0" class="max-lg:hidden">
        <ChevronRight16Filled class="h-4 text-gray-500 dark:text-gray-400" />
      </div>
      <button
        class="cursor-pointer line-clamp-1 text-ellipsis"
        :class="[index == paths.length - 1 ? '' : 'max-lg:hidden']"
        @click="openBreadcrumb(path.path)"
      >
        {{ path.name || $t('breadcrumb.volumes') }}
      </button>
    </template>
  </div>
</template>

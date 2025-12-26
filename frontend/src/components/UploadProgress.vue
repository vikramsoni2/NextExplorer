<script setup>
import { ref, computed, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToggle, useDraggable, useElementSize, useWindowSize } from '@vueuse/core';
import { PauseIcon, PlayIcon, XMarkIcon, ChevronDownIcon } from '@heroicons/vue/24/outline';
import { useUppyStore } from '@/stores/uppyStore';
import { formatBytes } from '@/utils';

const props = defineProps({
  forceVisible: { type: Boolean, default: false },
  defaultDetailsOpen: { type: Boolean, default: false },
  defaultPaused: { type: Boolean, default: false },
  draggable: { type: Boolean, default: true },
  initialPosition: {
    type: Object,
    default: () => ({ x: 400, y: 400 }),
  },
});

const uppyStore = useUppyStore();
const { t } = useI18n();
const [detailsOpen, toggleDetails] = useToggle(props.defaultDetailsOpen);
const isPaused = ref(props.defaultPaused);

const el = ref(null);
const { width: viewportWidth, height: viewportHeight } = useWindowSize();
const { width: panelWidth, height: panelHeight } = useElementSize(el);
const edgeOffset = 16;

const { x, y, style } = useDraggable(el, {
  initialValue: props.initialPosition,
  preventDefault: true,
  disabled: computed(() => !props.draggable),
});

// Auto-clamp position to keep panel in viewport - watchEffect automatically tracks all dependencies
watchEffect(() => {
  const viewW = viewportWidth.value || 1024;
  const viewH = viewportHeight.value || 768;
  const panelW = panelWidth.value || 360;
  const panelH = panelHeight.value || 200;

  const maxX = Math.max(edgeOffset, viewW - panelW - edgeOffset);
  const maxY = Math.max(edgeOffset, viewH - panelH - edgeOffset);

  x.value = Math.max(edgeOffset, Math.min(x.value, maxX));
  y.value = Math.max(edgeOffset, Math.min(y.value, maxY));
});

const filesById = computed(() => {
  const files = uppyStore.state.files ?? {};
  if (Array.isArray(files)) {
    return files.reduce((acc, group) => {
      if (group && typeof group === 'object') Object.assign(acc, group);
      return acc;
    }, {});
  }
  return files;
});

const filesWithProgress = computed(() => {
  return Object.values(filesById.value)
    .map((file) => {
      const progress = file?.progress ?? {};
      const bytesTotal = progress.bytesTotal ?? file?.size ?? 0;
      const uploadedRaw = progress.uploadComplete ? bytesTotal : (progress.bytesUploaded ?? 0);
      const bytesUploaded = Math.min(uploadedRaw, bytesTotal);
      const percentage = progress.uploadComplete
        ? 100
        : Math.round(
            progress.percentage ?? (bytesTotal > 0 ? (bytesUploaded / bytesTotal) * 100 : 0)
          );

      return {
        ...file,
        _progress: {
          bytesTotal,
          bytesUploaded,
          percentage,
          uploadComplete: Boolean(progress.uploadComplete),
          startedAt: progress.uploadStarted ?? 0,
          indeterminate: bytesTotal === 0,
        },
      };
    })
    .sort((a, b) => b._progress.startedAt - a._progress.startedAt);
});

const fileStats = computed(() => {
  return filesWithProgress.value.reduce(
    (acc, file) => {
      acc.totalBytes += file._progress.bytesTotal;
      acc.uploadedBytes += file._progress.bytesUploaded;
      acc.totalCount += 1;
      if (file._progress.uploadComplete) acc.completedCount += 1;
      else acc.activeCount += 1;
      return acc;
    },
    {
      totalBytes: 0,
      uploadedBytes: 0,
      totalCount: 0,
      activeCount: 0,
      completedCount: 0,
    }
  );
});

const destinationFolder = computed(() => {
  const target = filesWithProgress.value.find((file) => file.meta?.uploadTo);
  return target?.meta?.uploadTo ?? null;
});

const progress = computed(() => uppyStore.state.totalProgress ?? 0);
const roundedProgress = computed(() => Math.round(progress.value ?? 0));
const overallBarWidth = computed(() => Math.min(progress.value ?? 0, 100));

const uploadInProgress = computed(() => {
  if (props.forceVisible) return true;
  const currentUploads = uppyStore.state.currentUploads ?? {};
  return Object.keys(currentUploads).length > 0 || fileStats.value.activeCount > 0;
});

const totalBytes = computed(() => fileStats.value.totalBytes);
const uploadedBytes = computed(() => fileStats.value.uploadedBytes);

// Controls
function onTogglePause() {
  if (isPaused.value) {
    uppyStore.uppy.resumeAll?.();
    isPaused.value = false;
  } else {
    uppyStore.uppy.pauseAll?.();
    isPaused.value = true;
  }
}

function onCancelAll() {
  uppyStore.uppy.cancelAll?.({ reason: 'user' });
}

// Keyboard access for details chevron
function toggleDetailsKey(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    toggleDetails();
  }
}
</script>

<template>
  <div
    ref="el"
    v-if="uploadInProgress"
    class="fixed min-w-[360px] max-w-sm max-h-[400px] rounded-2xl border border-zinc-200/70 dark:border-white/10 bg-white/85 dark:bg-zinc-700/90 backdrop-blur-md shadow-xl ring-1 ring-black/5"
    role="status"
    aria-live="polite"
    :style="style"
  >
    <!-- Header -->
    <div class="p-5">
      <div class="flex items-center gap-3">
        <h3 class="text-lg font-semibold tracking-tight">
          {{ t('status.completePercent', { percent: roundedProgress }) }}
        </h3>

        <div class="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            :title="detailsOpen ? t('upload.toggleDetailsHide') : t('upload.toggleDetailsShow')"
            :aria-label="
              detailsOpen ? t('upload.toggleDetailsHide') : t('upload.toggleDetailsShow')
            "
            :aria-expanded="detailsOpen"
            @click="toggleDetails()"
            @keydown="toggleDetailsKey"
            class="h-9 w-9 rounded-full grid place-items-center hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <ChevronDownIcon
              class="h-5 w-5 transition-transform"
              :class="detailsOpen ? 'rotate-180' : ''"
            />
          </button>

          <button
            type="button"
            :title="isPaused ? t('upload.resumeUploads') : t('upload.pauseUploads')"
            :aria-label="isPaused ? t('upload.resumeUploads') : t('upload.pauseUploads')"
            @click="onTogglePause"
            class="h-9 w-9 rounded-full grid place-items-center hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <component :is="isPaused ? PlayIcon : PauseIcon" class="h-5 w-5" />
          </button>

          <button
            type="button"
            :title="t('actions.cancelAll')"
            :aria-label="t('actions.cancelAll')"
            @click="onCancelAll"
            class="h-9 w-9 rounded-full grid place-items-center hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>
      </div>

      <div class="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        {{
          t('upload.uploads', {
            count: fileStats.totalCount,
            items: fileStats.totalCount === 1 ? t('common.item') : t('common.items'),
          })
        }}
        <template v-if="destinationFolder">
          {{ t('common.to') }}
          <span class="text-indigo-600 dark:text-indigo-300 font-medium">{{
            destinationFolder
          }}</span>
        </template>
      </div>

      <!-- Overall progress bar -->
      <div class="mt-3">
        <div
          class="w-full h-3 rounded-full overflow-hidden border border-zinc-200/70 dark:border-zinc-700/50 bg-zinc-100/80 dark:bg-zinc-800/70"
        >
          <div
            class="h-full rounded-full upload-bar"
            :class="[
              isPaused ? 'opacity-60' : 'upload-bar--animated',
              roundedProgress === 100 ? 'upload-bar--complete' : 'upload-bar--active',
            ]"
            :style="`width: ${overallBarWidth}%;`"
          />
        </div>
      </div>

      <!-- Overall stats -->
      <div class="mt-2 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300">
        <div class="flex items-center gap-2">
          <span v-if="fileStats.completedCount"
            >{{ fileStats.completedCount }} {{ t('common.done') }}</span
          >
          <span v-if="fileStats.completedCount && fileStats.activeCount" aria-hidden="true">·</span>
          <span v-if="fileStats.activeCount"
            >{{ fileStats.activeCount }} {{ t('common.remaining') }}</span
          >
        </div>
        <div class="tabular-nums">
          {{ formatBytes(uploadedBytes) }} / {{ formatBytes(totalBytes) }}
        </div>
      </div>
    </div>

    <!-- Details list -->
    <div
      v-if="detailsOpen"
      class="details-panel border-t border-zinc-200/70 dark:border-zinc-700/50 divide-y divide-zinc-200/70 dark:divide-zinc-700/50"
    >
      <div v-for="file in filesWithProgress" :key="file.id" class="details-item px-5 py-3">
        <div class="flex items-start gap-3">
          <!-- File badge -->
          <div
            class="mt-0.5 h-6 w-6 shrink-0 grid place-items-center rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 uppercase text-[10px] font-semibold"
          >
            {{ (file.extension || file.type || 'file').toString().split('/').pop().slice(0, 3) }}
          </div>

          <!-- Name + per-file stats -->
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline gap-2">
              <span
                class="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100"
                :title="file.name"
              >
                {{ file.name }}
              </span>
              <span
                class="text-xs shrink-0"
                :class="file._progress.uploadComplete ? 'text-emerald-600' : 'text-zinc-500'"
              >
                {{
                  file._progress.uploadComplete
                    ? t('common.done')
                    : file._progress.indeterminate
                      ? '...'
                      : file._progress.percentage + '%'
                }}
              </span>
            </div>

            <div
              class="mt-1 h-2 overflow-hidden rounded-full border border-zinc-200/70 dark:border-zinc-700/50 bg-zinc-100 dark:bg-zinc-800"
            >
              <div
                class="h-full rounded-full upload-bar"
                :class="[
                  !file._progress.uploadComplete && !isPaused ? 'upload-bar--animated' : '',
                  file._progress.uploadComplete ? 'upload-bar--complete' : 'upload-bar--active',
                ]"
                :style="`width: ${file._progress.percentage}%;`"
              />
            </div>

            <div class="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
              {{ formatBytes(file._progress.bytesUploaded) }} /
              {{ formatBytes(file._progress.bytesTotal) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Modern indigo fill with a subtle left-to-right shimmer while active. */
.upload-bar {
  position: relative;
  overflow: hidden;
  --upload-pulse-width: 240px;
  transition:
    width 320ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 160ms ease;
}

/* Active (indigo), Completed (emerald) */
.upload-bar--active {
  background: linear-gradient(90deg, #4f46e5, #6366f1, #818cf8);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.25),
    0 0 0 1px rgba(79, 70, 229, 0.18),
    0 10px 24px rgba(79, 70, 229, 0.22);
}
.upload-bar--complete {
  background: linear-gradient(90deg, #10b981, #34d399, #6ee7b7);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    0 0 0 1px rgba(16, 185, 129, 0.2),
    0 10px 24px rgba(16, 185, 129, 0.18);
}

.upload-bar--animated.upload-bar--active {
  background-size: 200% 100%;
  animation: uploadGradientDrift 3.2s ease-in-out infinite;
}

.upload-bar--animated::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(var(--upload-pulse-width) * -1);
  width: var(--upload-pulse-width);
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.55) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  opacity: 0;
  filter: blur(0.1px);
  will-change: left, opacity;
  animation: uploadShimmer 1.6s ease-in-out infinite;
  pointer-events: none;
}

/* Reduce motion preference */
@media (prefers-reduced-motion: reduce) {
  .upload-bar {
    transition: none;
  }
  .upload-bar--animated.upload-bar--active {
    animation: none;
  }
  .upload-bar--animated::before {
    animation: none;
  }
}

@keyframes uploadGradientDrift {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 100% 50%;
  }
}

@keyframes uploadShimmer {
  0% {
    left: calc(var(--upload-pulse-width) * -1);
    opacity: 0;
  }
  15% {
    opacity: 0.85;
  }
  50% {
    opacity: 0.6;
  }
  85% {
    opacity: 0.85;
  }
  100% {
    left: calc(100% + var(--upload-pulse-width));
    opacity: 0;
  }
}

.details-panel {
  --upload-item-height: 4.5rem;
  max-height: calc(var(--upload-item-height) * 3);
  overflow-y: auto;
}

.details-item {
  min-height: var(--upload-item-height);
}
</style>

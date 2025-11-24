<script setup>
import { ref, computed, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToggle, useDraggable, useElementSize, useWindowSize } from '@vueuse/core'
import { PauseIcon, PlayIcon, XMarkIcon, ChevronDownIcon } from '@heroicons/vue/24/outline'
import { useUppyStore } from '@/stores/uppyStore'
import { formatBytes } from '@/utils'

const uppyStore = useUppyStore()
const { t } = useI18n();
const [detailsOpen, toggleDetails] = useToggle(false)
const isPaused = ref(false)

const el = ref(null)
const { width: viewportWidth, height: viewportHeight } = useWindowSize()
const { width: panelWidth, height: panelHeight } = useElementSize(el)
const edgeOffset = 16

const { x, y, style } = useDraggable(el, {
  initialValue: { x: 400, y: 400 },
  preventDefault: true,
})

// Auto-clamp position to keep panel in viewport - watchEffect automatically tracks all dependencies
watchEffect(() => {
  const viewW = viewportWidth.value || 1024
  const viewH = viewportHeight.value || 768
  const panelW = panelWidth.value || 360
  const panelH = panelHeight.value || 200

  const maxX = Math.max(edgeOffset, viewW - panelW - edgeOffset)
  const maxY = Math.max(edgeOffset, viewH - panelH - edgeOffset)

  x.value = Math.max(edgeOffset, Math.min(x.value, maxX))
  y.value = Math.max(edgeOffset, Math.min(y.value, maxY))
})



const filesById = computed(() => {
  const files = uppyStore.state.files ?? {}
  if (Array.isArray(files)) {
    return files.reduce((acc, group) => {
      if (group && typeof group === 'object') Object.assign(acc, group)
      return acc
    }, {})
  }
  return files
})

const filesWithProgress = computed(() => {
  return Object.values(filesById.value)
    .map((file) => {
      const progress = file?.progress ?? {}
      const bytesTotal = progress.bytesTotal ?? file?.size ?? 0
      const uploadedRaw = progress.uploadComplete ? bytesTotal : progress.bytesUploaded ?? 0
      const bytesUploaded = Math.min(uploadedRaw, bytesTotal)
      const percentage = progress.uploadComplete
        ? 100
        : Math.round(progress.percentage ?? (bytesTotal > 0 ? (bytesUploaded / bytesTotal) * 100 : 0))

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
      }
    })
    .sort((a, b) => b._progress.startedAt - a._progress.startedAt)
})

const fileStats = computed(() => {
  return filesWithProgress.value.reduce(
    (acc, file) => {
      acc.totalBytes += file._progress.bytesTotal
      acc.uploadedBytes += file._progress.bytesUploaded
      acc.totalCount += 1
      if (file._progress.uploadComplete) acc.completedCount += 1
      else acc.activeCount += 1
      return acc
    },
    { totalBytes: 0, uploadedBytes: 0, totalCount: 0, activeCount: 0, completedCount: 0 }
  )
})

const destinationFolder = computed(() => {
  const target = filesWithProgress.value.find((file) => file.meta?.uploadTo)
  return target?.meta?.uploadTo ?? null
})

const progress = computed(() => uppyStore.state.totalProgress ?? 0)
const roundedProgress = computed(() => Math.round(progress.value ?? 0))
const overallBarWidth = computed(() => Math.min(progress.value ?? 0, 100))

const uploadInProgress = computed(() => {
  const currentUploads = uppyStore.state.currentUploads ?? {}
  return Object.keys(currentUploads).length > 0 || fileStats.value.activeCount > 0
})

const totalBytes = computed(() => fileStats.value.totalBytes)
const uploadedBytes = computed(() => fileStats.value.uploadedBytes)

// Controls
function onTogglePause() {
  if (isPaused.value) {
    uppyStore.uppy.resumeAll?.()
    isPaused.value = false
  } else {
    uppyStore.uppy.pauseAll?.()
    isPaused.value = true
  }
}

function onCancelAll() {
  uppyStore.uppy.cancelAll?.({ reason: 'user' })
}

// Keyboard access for details chevron
function toggleDetailsKey(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    toggleDetails()
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
          {{ t('upload.completePercent', { percent: roundedProgress }) }}
        </h3>

        <div class="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            :title="detailsOpen ? t('upload.toggleDetailsHide') : t('upload.toggleDetailsShow')"
            :aria-label="detailsOpen ? t('upload.toggleDetailsHide') : t('upload.toggleDetailsShow')"
            :aria-expanded="detailsOpen"
            @click="toggleDetails()"
            @keydown="toggleDetailsKey"
            class="h-9 w-9 rounded-full grid place-items-center hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <ChevronDownIcon class="h-5 w-5 transition-transform" :class="detailsOpen ? 'rotate-180' : ''" />
          </button>

          <button
            type="button"
            :title="isPaused ? t('upload.resumeUploads') : t('upload.pauseUploads')"
            :aria-label="isPaused ? t('upload.resumeUploads') : t('upload.pauseUploads')"
            @click="onTogglePause"
            class="h-9 w-9 rounded-full grid place-items-center hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <component :is="isPaused ? PlayIcon : PauseIcon" class="h-5 w-5" />
          </button>

          <button
            type="button"
            :title="t('upload.cancelAll')"
            :aria-label="t('upload.cancelAll')"
            @click="onCancelAll"
            class="h-9 w-9 rounded-full grid place-items-center hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>
      </div>

      <div class="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        {{ t('upload.uploads', { count: fileStats.totalCount, items: fileStats.totalCount === 1 ? t('upload.item') : t('upload.items') }) }}
        <template v-if="destinationFolder">
          {{ t('upload.to') }} <span class="text-sky-600 dark:text-sky-300 font-medium">{{ destinationFolder }}</span>
        </template>
      </div>

      <!-- Overall progress bar -->
      <div class="mt-3">
        <div class="w-full h-3 rounded-full overflow-hidden border border-zinc-200/70 dark:border-zinc-700/50 bg-[linear-gradient(180deg,rgba(255,255,255,.9),rgba(255,255,255,.6))] dark:bg-[linear-gradient(180deg,rgba(24,24,27,.9),rgba(24,24,27,.6))]">
          <div
            class="h-full rounded-full win-bar"
            :class="[
              isPaused ? 'opacity-60' : 'win-bar--striped',
              roundedProgress === 100 ? 'win-bar--complete' : 'win-bar--active'
            ]"
            :style="`width: ${overallBarWidth}%;`"
          />
        </div>
      </div>

      <!-- Overall stats -->
      <div class="mt-2 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300">
        <div class="flex items-center gap-2">
          <span v-if="fileStats.completedCount">{{ fileStats.completedCount }} {{ t('upload.done') }}</span>
          <span v-if="fileStats.completedCount && fileStats.activeCount" aria-hidden="true">·</span>
          <span v-if="fileStats.activeCount">{{ fileStats.activeCount }} {{ t('upload.remaining') }}</span>
        </div>
        <div class="tabular-nums">{{ formatBytes(uploadedBytes) }} / {{ formatBytes(totalBytes) }}</div>
      </div>
    </div>

    <!-- Details list -->
    <div
      v-if="detailsOpen"
      class="details-panel border-t border-zinc-200/70 dark:border-zinc-700/50 divide-y divide-zinc-200/70 dark:divide-zinc-700/50"
    >
      <div
        v-for="file in filesWithProgress"
        :key="file.id"
        class="details-item px-5 py-3"
      >
        <div class="flex items-start gap-3">
          <!-- File badge -->
          <div class="mt-0.5 h-6 w-6 shrink-0 grid place-items-center rounded-md bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 uppercase text-[10px] font-semibold">
            {{ (file.extension || file.type || 'file').toString().split('/').pop().slice(0,3) }}
          </div>

          <!-- Name + per-file stats -->
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline gap-2">
              <span class="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100" :title="file.name">
                {{ file.name }}
              </span>
              <span
                class="text-xs shrink-0"
                :class="file._progress.uploadComplete ? 'text-emerald-600' : 'text-zinc-500'"
              >
                {{ file._progress.uploadComplete ? t('upload.done') : file._progress.indeterminate ? '...' : (file._progress.percentage + '%') }}
              </span>
            </div>

            <div class="mt-1 h-2 overflow-hidden rounded-full border border-zinc-200/70 dark:border-zinc-700/50 bg-zinc-100 dark:bg-zinc-800">
              <div
                class="h-full rounded-full win-bar"
                :class="[
                  !file._progress.uploadComplete && !isPaused ? 'win-bar--striped' : '',
                  file._progress.uploadComplete ? 'win-bar--complete' : 'win-bar--active'
                ]"
                :style="`width: ${file._progress.percentage}%;`"
              />
            </div>

            <div class="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
              {{ formatBytes(file._progress.bytesUploaded) }} / {{ formatBytes(file._progress.bytesTotal) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Windows-esque bar: subtle gradient, glossy edge, animated diagonal stripes while active */
.win-bar {
  background-image:
    linear-gradient(180deg, rgba(255,255,255,.45), rgba(255,255,255,0) 60%),
    linear-gradient(180deg, #6fb6ff, #0a7cff);
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.35),
    inset 0 -1px 0 rgba(0,0,0,.08);
  transition: width .3s ease, opacity .2s ease, background .3s ease;
}

/* Active (blue), Completed (green) */
.win-bar--active {
  background-image:
    linear-gradient(180deg, rgba(255,255,255,.45), rgba(255,255,255,0) 60%),
    linear-gradient(180deg, #6fb6ff, #0a7cff);
}
.win-bar--complete {
  background-image:
    linear-gradient(180deg, rgba(255,255,255,.45), rgba(255,255,255,0) 60%),
    linear-gradient(180deg, #6ee7b7, #10b981);
}

/* Diagonal stripe animation (like Windows indeterminate feel but determinate-friendly) */
.win-bar--striped {
  position: relative;
  overflow: hidden;
}
.win-bar--striped::before {
  content: '';
  position: absolute;
  inset: 0;
  background-size: 28px 28px;
  background-image: linear-gradient(
    135deg,
    rgba(255,255,255,.28) 25%,
    rgba(255,255,255,0) 25%,
    rgba(255,255,255,0) 50%,
    rgba(255,255,255,.28) 50%,
    rgba(255,255,255,.28) 75%,
    rgba(255,255,255,0) 75%,
    rgba(255,255,255,0) 100%
  );
  animation: winStripe 1.2s linear infinite;
  pointer-events: none;
}

/* Reduce motion preference */
@media (prefers-reduced-motion: reduce) {
  .win-bar--striped::before { animation: none; }
}

@keyframes winStripe {
  from { background-position: 0 0; }
  to   { background-position: 28px 0; }
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

<script setup>
import { computed, ref } from 'vue'
import { useDraggable } from '@vueuse/core'
import { PauseIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { useUppyStore } from '@/stores/uppyStore'
import { formatBytes } from '@/utils';
const uppyStore = useUppyStore()

const el = ref(null)

// `style` will be a helper computed for `left: ?px; top: ?px;`
const { x, y, style } = useDraggable(el, {
  initialValue: { x: 400, y: 400 },
  preventDefault: true,
})

const progress = computed(() => uppyStore.state.totalProgress)

const uploadInProgress = computed(() => Object.keys(uppyStore.state.currentUploads).length > 0)

const totalBytes = computed(() => Object.values(uppyStore.state.files)
    .filter(file => !file.progress.uploadComplete) // Filter files where upload isn't complete
    .reduce((acc, file) => acc + file.progress.bytesTotal, 0)  )

const uploadedBytes = computed(() => Object.values(uppyStore.state.files)
    .filter(file => !file.progress.uploadComplete) // Filter files where upload isn't complete
    .reduce((acc, file) => acc + file.progress.bytesUploaded, 0)
)


</script>
<template>
  <div v-if="uploadInProgress" ref="el" class="fixed p-6 bg-neutral-100 dark:bg-zinc-900 shadow-lg min-w-[500px] rounded-xl
  border border-neutral-200 d dark:border-none
  " :style="style">
    <h3 class="text-xl font-extrabold mb-3">{{progress}}% complete</h3>
    <div class="text-md flex items-center gap-2">
      <div>Uploading 2 items to <span class="text-sky-600 dark:text-sky-300">Photos</span></div>
      <button @click="uppyStore.uppy.pauseAll()" class="ml-auto"> <PauseIcon class="w-6 h-6" /></button>
      <button @click="uppyStore.uppy.cancelAll({ reason: 'user' })"><XMarkIcon class="w-6 h-6" /></button>
    </div>
    <div class="my-2">
      <div class="bg-zinc-300 dark:bg-zinc-700 h-2 rounded-full">
        <div class="bg-sky-500 h-2 rounded-full" :style="`width: ${progress}%`"></div>
      </div>
    </div>
    <div class="flex items-center justify-between">
      <div>About 16 min remaining</div>
      <div class="text-sm">{{ formatBytes(uploadedBytes) }} / {{ formatBytes(totalBytes) }}</div>
    </div>
    
  </div>
</template>
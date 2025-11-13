<script setup>
import { computed } from 'vue';

/**
 * Props:
 * - used / total: numbers representing the same unit (bytes, GB, etc.)
 * - size: sm | md | lg (height variants)
 * - color: override color class (else auto by thresholds)
 * - dangerAt / warnAt: percent thresholds (0–100)
 */
const props = defineProps({
  used: { type: Number, required: true },
  total: { type: Number, required: true },
  size: { type: String, default: 'md' },
  color: { type: String, default: '' },
  dangerAt: { type: Number, default: 90 },
  warnAt: { type: Number, default: 75 }
});

const pct = computed(() => {
  if (!props.total || props.total <= 0) return 0;
  const raw = (props.used / props.total) * 100;
  return Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 0));
});

const heightClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'h-2';
    case 'lg': return 'h-4';
    default: return 'h-3';
  }
});

const barColor = computed(() => {
  if (props.color) return props.color;
  if (pct.value >= props.dangerAt) return 'bg-red-500 dark:bg-red-400';
  if (pct.value >= props.warnAt) return 'bg-amber-500 dark:bg-amber-400';
  return 'bg-sky-500 dark:bg-sky-400';
});
</script>

<template>
  <div class="w-full">
    <div
      class="relative w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-600"
      :class="heightClass"
      role="progressbar"
      :aria-valuemin="0"
      :aria-valuemax="100"
      :aria-valuenow="Math.round(pct)"
      :aria-label="'Usage'"
    >
      <div
        class="h-full transition-[width] duration-300 ease-out"
        :class="barColor"
        :style="{ width: pct + '%' }"
      />
    </div>
  </div>
</template>

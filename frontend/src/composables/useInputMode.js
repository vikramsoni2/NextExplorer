import { computed } from 'vue';

export function useInputMode() {
  const isTouchDevice = computed(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const hasTouchPoints = 'maxTouchPoints' in navigator && navigator.maxTouchPoints > 0;
    const hasCoarsePointer =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(pointer: coarse)').matches
        : false;
    const hasTouchEvent = 'ontouchstart' in window;
    return hasTouchPoints || hasCoarsePointer || hasTouchEvent;
  });

  return { isTouchDevice };
}


import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useSpotlightStore = defineStore('spotlight', () => {
  const isOpen = ref(false);

  const open = () => { isOpen.value = true; };
  const close = () => { isOpen.value = false; };
  const toggle = () => { isOpen.value = !isOpen.value; };

  return {
    isOpen,
    open,
    close,
    toggle,
  };
});


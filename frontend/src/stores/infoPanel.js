import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { normalizePath } from '@/api';

export const useInfoPanelStore = defineStore('infoPanel', () => {
  const isOpen = ref(false);
  const item = ref(null);

  const open = (target) => {
    item.value = target || null;
    isOpen.value = Boolean(target);
  };

  const close = () => {
    isOpen.value = false;
  };

  const relativePath = computed(() => {
    const it = item.value;
    if (!it || !it.name) return '';
    const parent = normalizePath(it.path || '');
    const combined = parent ? `${parent}/${it.name}` : it.name;
    return normalizePath(combined);
  });

  return {
    isOpen,
    item,
    open,
    close,
    relativePath,
  };
});


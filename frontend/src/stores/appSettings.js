import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getSettings as getSettingsApi, patchSettings as patchSettingsApi } from '@/api';

export const useAppSettings = defineStore('appSettings', () => {
  const loaded = ref(false);
  const loading = ref(false);
  const lastError = ref(null);
  const state = ref({
    thumbnails: { enabled: true, size: 200, quality: 70 },
    access: { rules: [] },
  });

  const load = async () => {
    loading.value = true;
    lastError.value = null;
    try {
      const s = await getSettingsApi();
      state.value = {
        thumbnails: { enabled: true, size: 200, quality: 70, ...(s?.thumbnails || {}) },
        access: { rules: Array.isArray(s?.access?.rules) ? s.access.rules : [] },
      };
      loaded.value = true;
    } catch (e) {
      lastError.value = e?.message || 'Failed to load settings';
    } finally {
      loading.value = false;
    }
  };

  const save = async (partial) => {
    lastError.value = null;
    const updated = await patchSettingsApi(partial);
    state.value = {
      thumbnails: { enabled: true, size: 200, quality: 70, ...(updated?.thumbnails || {}) },
      access: { rules: Array.isArray(updated?.access?.rules) ? updated.access.rules : [] },
    };
    loaded.value = true;
    return state.value;
  };

  return { state, loaded, loading, lastError, load, save };
});

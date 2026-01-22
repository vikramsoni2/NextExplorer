import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getBranding as getBrandingApi, getSettings as getSettingsApi, patchSettings as patchSettingsApi } from '@/api';

export const useAppSettings = defineStore('appSettings', () => {
  const loaded = ref(false);
  const loading = ref(false);
  const lastError = ref(null);
  const state = ref({
    thumbnails: { enabled: true, size: 200, quality: 70 },
    access: { rules: [] },
    branding: { appName: 'Explorer', appLogoUrl: '/logo.svg', showPoweredBy: false },
  });

  // Load public branding (no auth required) - can be called on login page
  const loadBranding = async () => {
    lastError.value = null;
    try {
      const b = await getBrandingApi();
      state.value.branding = {
        appName: 'Explorer',
        appLogoUrl: '/logo.svg',
        showPoweredBy: false,
        ...(b || {}),
      };
    } catch (e) {
      console.debug('Failed to load branding:', e?.message || 'Unknown error');
      // Don't set lastError for branding - it's not critical
    }
  };

  // Load all settings (admin only) - requires authentication
  const load = async () => {
    loading.value = true;
    lastError.value = null;
    try {
      const s = await getSettingsApi();
      state.value = {
        thumbnails: {
          enabled: true,
          size: 200,
          quality: 70,
          ...(s?.thumbnails || {}),
        },
        access: {
          rules: Array.isArray(s?.access?.rules) ? s.access.rules : [],
        },
         branding: {
          appName: 'Explorer',
          appLogoUrl: '/logo.svg',
          showPoweredBy: false,
          ...(s?.branding || {}),
        },
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
      thumbnails: {
        enabled: true,
        size: 200,
        quality: 70,
        ...(updated?.thumbnails || {}),
      },
      access: {
        rules: Array.isArray(updated?.access?.rules) ? updated.access.rules : [],
      },
       branding: {
         appName: 'Explorer',
         appLogoUrl: '/logo.svg',
         showPoweredBy: false,
         ...(updated?.branding || {}),
       },
    };
    loaded.value = true;
    return state.value;
  };

  return { state, loaded, loading, lastError, load, loadBranding, save };
});

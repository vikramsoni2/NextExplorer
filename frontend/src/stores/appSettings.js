import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  getBranding as getBrandingApi,
  getSettings as getSettingsApi,
  patchSettings as patchSettingsApi,
} from '@/api';
import { useAuthStore } from '@/stores/auth';

export const useAppSettings = defineStore('appSettings', () => {
  const loaded = ref(false);
  const loading = ref(false);
  const lastError = ref(null);
  const authStore = useAuthStore();

  // Three-tier settings structure
  const publicSettings = ref({
    branding: { appName: 'Explorer', appLogoUrl: '/logo.svg', showPoweredBy: false },
  });

  const userSettings = ref({
    showHiddenFiles: false,
    showThumbnails: true,
    defaultShareExpiration: null, // { value: number, unit: 'days' | 'weeks' | 'months' }
    skipHome: null, // null = use env var, true/false = override
  });

  const systemSettings = ref({
    thumbnails: { enabled: true, size: 200, quality: 70 },
    access: { rules: [] },
  });

  // Computed state that combines all settings (for backward compatibility)
  const state = computed(() => ({
    branding: publicSettings.value.branding,
    user: userSettings.value,
    thumbnails: systemSettings.value.thumbnails,
    access: systemSettings.value.access,
  }));

  // Whether thumbnails should be shown/requested for the current session.
  // - System toggle (admin) applies globally when known.
  // - User preference applies only when a user is authenticated.
  // - When settings aren't loaded (e.g. guest/share sessions), fail open and rely on
  //   backend-provided `supportsThumbnail` + thumbnail endpoint behavior.
  const thumbnailsEnabledForSession = computed(() => {
    if (loaded.value && systemSettings.value?.thumbnails?.enabled === false) {
      return false;
    }

    const hasUser = Boolean(authStore.currentUser);
    if (loaded.value && hasUser && userSettings.value?.showThumbnails === false) {
      return false;
    }

    return true;
  });

  // Load public branding (no auth required) - can be called on login page
  const loadBranding = async () => {
    lastError.value = null;
    try {
      const b = await getBrandingApi();
      publicSettings.value.branding = {
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

  // Load settings based on user role
  // - No auth: branding only
  // - Authenticated user: branding + user settings
  // - Admin: branding + user settings + system settings
  const load = async () => {
    loading.value = true;
    lastError.value = null;
    try {
      const s = await getSettingsApi();

      // Always update branding (public)
      if (s?.branding) {
        publicSettings.value.branding = {
          appName: 'Explorer',
          appLogoUrl: '/logo.svg',
          showPoweredBy: false,
          ...s.branding,
        };
      }

      // Update user settings if present (authenticated users)
      if (s?.user && typeof s.user === 'object') {
        userSettings.value = {
          showHiddenFiles: false,
          showThumbnails: true,
          defaultShareExpiration: null,
          skipHome: null,
          ...s.user,
        };
      }

      // Update system settings if present (admin only)
      if (s?.thumbnails) {
        systemSettings.value.thumbnails = {
          enabled: true,
          size: 200,
          quality: 70,
          ...s.thumbnails,
        };
      }
      if (s?.access) {
        systemSettings.value.access = {
          rules: Array.isArray(s.access.rules) ? s.access.rules : [],
        };
      }

      loaded.value = true;
    } catch (e) {
      // For non-admin users, 403 errors are expected for system settings
      // But we should still have branding loaded
      const authStore = useAuthStore();
      const isAdmin =
        authStore.currentUser &&
        Array.isArray(authStore.currentUser?.roles) &&
        authStore.currentUser.roles.includes('admin');

      if (!isAdmin && e?.status === 403) {
        // Non-admin user - this is expected, just ensure branding is loaded
        await loadBranding();
        loaded.value = true;
      } else {
        lastError.value = e?.message || 'Failed to load settings';
      }
    } finally {
      loading.value = false;
    }
  };

  const ensureLoaded = async () => {
    if (loaded.value || loading.value) {
      return state.value;
    }
    await load();
    return state.value;
  };

  const save = async (partial) => {
    lastError.value = null;
    try {
      const updated = await patchSettingsApi(partial);

      // Update local state based on what was returned
      if (updated?.branding) {
        publicSettings.value.branding = {
          appName: 'Explorer',
          appLogoUrl: '/logo.svg',
          showPoweredBy: false,
          ...updated.branding,
        };
      }

      if (updated?.user) {
        userSettings.value = {
          ...userSettings.value,
          ...updated.user,
        };
      }

      if (updated?.thumbnails) {
        systemSettings.value.thumbnails = {
          enabled: true,
          size: 200,
          quality: 70,
          ...updated.thumbnails,
        };
      }

      if (updated?.access) {
        systemSettings.value.access = {
          rules: Array.isArray(updated.access.rules) ? updated.access.rules : [],
        };
      }

      loaded.value = true;
      return state.value;
    } catch (e) {
      lastError.value = e?.message || 'Failed to save settings';
      throw e;
    }
  };

  return {
    state,
    publicSettings,
    userSettings,
    systemSettings,
    loaded,
    loading,
    lastError,
    thumbnailsEnabledForSession,
    load,
    ensureLoaded,
    loadBranding,
    save,
  };
});

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  fetchAuthStatus,
  setupAccount as setupAccountApi,
  login as loginApi,
  logout as logoutApi,
  fetchCurrentUser,
} from '@/api';

export const useAuthStore = defineStore('auth', () => {
  const requiresSetup = ref(false);
  const authEnabled = ref(true);
  const authMode = ref('local');
  const strategies = ref({
    local: true,
    oidc: false,
  });
  const currentUser = ref(null);
  const isLoading = ref(false);
  const hasStatus = ref(false);
  const lastError = ref(null);
  let initPromise = null;

  const isAuthenticated = computed(() => {
    if (!authEnabled.value) {
      return true;
    }
    return Boolean(currentUser.value);
  });

  const initialize = async () => {
    if (initPromise) {
      return initPromise;
    }

    initPromise = (async () => {
      isLoading.value = true;
      lastError.value = null;

      try {
        const status = await fetchAuthStatus();
        requiresSetup.value = Boolean(status.requiresSetup);
        authEnabled.value = status?.authEnabled !== false;
        authMode.value = typeof status?.authMode === 'string' ? status.authMode : 'local';
        strategies.value = status?.strategies || { local: true, oidc: false };
        currentUser.value = status?.user || null;

        // Cookies hold session; no token adjustments needed
      } catch (error) {
        lastError.value = error instanceof Error ? error.message : 'Failed to load authentication status.';
      } finally {
        hasStatus.value = true;
        isLoading.value = false;
        initPromise = null;
      }
    })();

    return initPromise;
  };

  const setupAccount = async ({ email, username, password }) => {
    lastError.value = null;
    const response = await setupAccountApi({ email, username, password });
    requiresSetup.value = false;
    hasStatus.value = true;
    currentUser.value = response?.user || null;
  };

  const login = async ({ email, password }) => {
    lastError.value = null;
    const response = await loginApi({ email, password });
    hasStatus.value = true;
    currentUser.value = response?.user || null;
  };

  const logout = async () => {
    lastError.value = null;
    try { await logoutApi(); } catch (_) {}
    hasStatus.value = true;
    currentUser.value = null;
  };

  const clearError = () => {
    lastError.value = null;
  };

  const refreshCurrentUser = async () => {
    try {
      const response = await fetchCurrentUser();
      currentUser.value = response?.user || null;
      return currentUser.value;
    } catch (error) {
      currentUser.value = null;
      throw error;
    }
  };

  return {
    requiresSetup,
    isLoading,
    hasStatus,
    isAuthenticated,
    authEnabled,
    authMode,
    strategies,
    currentUser,
    lastError,
    initialize,
    ensureStatus: initialize,
    setupAccount,
    login,
    logout,
    clearError,
    refreshCurrentUser,
  };
});

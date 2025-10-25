import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  setAuthToken,
  clearAuthToken,
  fetchAuthStatus,
  setupAccount as setupAccountApi,
  login as loginApi,
  logout as logoutApi,
  fetchCurrentUser,
  issueAuthToken,
} from '@/api';

const STORAGE_KEY = 'next-explorer-auth-token';

const loadStoredToken = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored || null;
};

export const useAuthStore = defineStore('auth', () => {
  const token = ref(loadStoredToken());
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

  if (token.value) {
    setAuthToken(token.value);
  }

  const isAuthenticated = computed(() => {
    if (!authEnabled.value) {
      return true;
    }
    return Boolean(currentUser.value) || Boolean(token.value);
  });

  const persistToken = (newToken) => {
    token.value = newToken || null;
    if (token.value) {
      setAuthToken(token.value);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, token.value);
      }
    } else {
      clearAuthToken();
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  };

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

        if (!requiresSetup.value && token.value && !status.authenticated) {
          persistToken(null);
        }
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

  const setupAccount = async ({ username, password }) => {
    lastError.value = null;
    const response = await setupAccountApi({ username, password });
    persistToken(response?.token || null);
    requiresSetup.value = false;
    hasStatus.value = true;
    currentUser.value = response?.user || null;
  };

  const login = async ({ username, password }) => {
    lastError.value = null;
    const response = await loginApi({ username, password });
    persistToken(response?.token || null);
    hasStatus.value = true;
    currentUser.value = response?.user || null;
  };

  const logout = async () => {
    lastError.value = null;
    try {
      await logoutApi();
    } catch (error) {
      // Ignore logout errors so we can still clear the session client-side.
    }
    persistToken(null);
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

  const mintToken = async () => {
    const response = await issueAuthToken();
    persistToken(response?.token || null);
    return response?.token || null;
  };

  return {
    token,
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
    mintToken,
  };
});

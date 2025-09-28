<script setup>
import { RouterView } from 'vue-router';
import { computed, onMounted, ref, watch } from 'vue';

import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();

const setupPasswordValue = ref('');
const setupConfirmValue = ref('');
const loginPasswordValue = ref('');

const setupError = ref('');
const loginError = ref('');
const statusError = ref('');

const isSubmittingSetup = ref(false);
const isSubmittingLogin = ref(false);

onMounted(() => {
  auth.initialize();
});

watch(
  () => auth.lastError,
  (message) => {
    statusError.value = message || '';
  },
);

const showSetup = computed(() => !auth.isLoading && auth.requiresSetup);
const showLogin = computed(() => !auth.isLoading && !auth.requiresSetup && !auth.isAuthenticated);
const showApp = computed(() => !auth.isLoading && auth.isAuthenticated);

const handleSetupSubmit = async () => {
  setupError.value = '';
  statusError.value = '';

  if (setupPasswordValue.value.length < 6) {
    setupError.value = 'Password must be at least 6 characters long.';
    return;
  }

  if (setupPasswordValue.value !== setupConfirmValue.value) {
    setupError.value = 'Passwords do not match.';
    return;
  }

  isSubmittingSetup.value = true;

  try {
    auth.clearError();
    await auth.setupPassword(setupPasswordValue.value);
    setupPasswordValue.value = '';
    setupConfirmValue.value = '';
  } catch (error) {
    setupError.value = error instanceof Error ? error.message : 'Failed to create password.';
  } finally {
    isSubmittingSetup.value = false;
  }
};

const handleLoginSubmit = async () => {
  loginError.value = '';
  statusError.value = '';

  if (!loginPasswordValue.value) {
    loginError.value = 'Password is required.';
    return;
  }

  isSubmittingLogin.value = true;

  try {
    auth.clearError();
    await auth.login(loginPasswordValue.value);
    loginPasswordValue.value = '';
  } catch (error) {
    loginError.value = error instanceof Error ? error.message : 'Failed to sign in.';
  } finally {
    isSubmittingLogin.value = false;
  }
};
</script>

<template>
  <div v-if="auth.isLoading" class="min-h-screen flex items-center justify-center bg-slate-900 text-white">
    <p class="text-lg font-medium">Checking access…</p>
  </div>

  <div v-else-if="showSetup" class="min-h-screen flex items-center justify-center bg-slate-900">
    <div class="w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
      <h1 class="text-2xl font-semibold text-slate-900">Create a password</h1>
      <p class="mt-2 text-sm text-slate-600">Secure your explorer by creating a password. Keep it somewhere safe.</p>

      <form class="mt-6 space-y-4" @submit.prevent="handleSetupSubmit">
        <div>
          <label for="setup-password" class="block text-sm font-medium text-slate-700">Password</label>
          <input
            id="setup-password"
            v-model="setupPasswordValue"
            type="password"
            autocomplete="new-password"
            class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            :disabled="isSubmittingSetup"
          />
        </div>

        <div>
          <label for="setup-password-confirm" class="block text-sm font-medium text-slate-700">Confirm password</label>
          <input
            id="setup-password-confirm"
            v-model="setupConfirmValue"
            type="password"
            autocomplete="new-password"
            class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            :disabled="isSubmittingSetup"
          />
        </div>

        <p v-if="setupError" class="text-sm text-red-600">{{ setupError }}</p>
        <p v-else-if="statusError" class="text-sm text-red-600">{{ statusError }}</p>

        <button
          type="submit"
          class="w-full rounded bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
          :disabled="isSubmittingSetup"
        >
          <span v-if="isSubmittingSetup">Saving…</span>
          <span v-else>Save password</span>
        </button>
      </form>
    </div>
  </div>

  <div v-else-if="showLogin" class="min-h-screen flex items-center justify-center bg-slate-900">
    <div class="w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
      <h1 class="text-2xl font-semibold text-slate-900">Enter password</h1>
      <p class="mt-2 text-sm text-slate-600">This password protects all features of the explorer.</p>

      <form class="mt-6 space-y-4" @submit.prevent="handleLoginSubmit">
        <div>
          <label for="login-password" class="block text-sm font-medium text-slate-700">Password</label>
          <input
            id="login-password"
            v-model="loginPasswordValue"
            type="password"
            autocomplete="current-password"
            class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            :disabled="isSubmittingLogin"
          />
        </div>

        <p v-if="loginError" class="text-sm text-red-600">{{ loginError }}</p>
        <p v-else-if="statusError" class="text-sm text-red-600">{{ statusError }}</p>

        <button
          type="submit"
          class="w-full rounded bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
          :disabled="isSubmittingLogin"
        >
          <span v-if="isSubmittingLogin">Signing in…</span>
          <span v-else>Sign in</span>
        </button>
      </form>
    </div>
  </div>

  <router-view v-else-if="showApp" />
</template>

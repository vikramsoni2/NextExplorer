<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import HeaderLogo from '@/components/HeaderLogo.vue';
import { useAuthStore } from '@/stores/auth';

const version = __APP_VERSION__

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const setupPasswordValue = ref('');
const setupConfirmValue = ref('');
const setupError = ref('');
const isSubmittingSetup = ref(false);

const statusError = computed(() => auth.lastError || '');
const redirectTarget = computed(() => {
  const redirect = route.query?.redirect;
  if (typeof redirect === 'string' && redirect.trim()) {
    return redirect;
  }
  return '/browse/';
});

const inputBaseClasses =
  'mt-2 w-full rounded-lg border border-white/10 bg-nextzinc-900/70 px-4 py-2 text-nextgray-100 placeholder-nextgray-300 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/60 transition';

const buttonBaseClasses =
  'w-full rounded-lg bg-accent px-4 py-2 font-semibold text-nextzinc-900 shadow-lg shadow-accent/30 transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60';

const helperTextClasses = 'text-sm text-red-400';

const redirectToDestination = () => {
  const target = redirectTarget.value;
  router.replace(typeof target === 'string' ? target : '/browse/');
};

watch(
  () => auth.requiresSetup,
  (requiresSetup) => {
    if (!requiresSetup && auth.hasStatus) {
      redirectToDestination();
    }
  },
  { immediate: true },
);

onMounted(() => {
  if (!auth.hasStatus && !auth.isLoading) {
    auth.initialize();
  }
});

const resetErrors = () => {
  setupError.value = '';
  auth.clearError();
};

const handleSetupSubmit = async () => {
  resetErrors();

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
    await auth.setupPassword(setupPasswordValue.value);
    setupPasswordValue.value = '';
    setupConfirmValue.value = '';
    redirectToDestination();
  } catch (error) {
    setupError.value = error instanceof Error ? error.message : 'Failed to create password.';
  } finally {
    isSubmittingSetup.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-nextzinc-900 via-slateblue to-nextgray-400/40 text-nextgray-100">
    <div class="flex min-h-screen items-center justify-center px-4 py-12">
      <div v-if="auth.isLoading" class="flex flex-col items-center gap-3">
        <div class="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-accent"></div>
        <p class="text-lg font-medium tracking-wide text-nextgray-100/80">Preparing your explorer…</p>
      </div>

      <div
        v-else
        class="w-full max-w-lg rounded-3xl border border-white/10 bg-nextzinc-900/80 p-8 shadow-2xl shadow-black/40 backdrop-blur-md"
      >
        <div class="flex items-center justify-between border-b border-white/5 pb-6">
          <HeaderLogo class="mb-0" />
          <span class="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white/70">
            Version {{ version }}
          </span>
        </div>

        <div class="mt-6 space-y-6">
          <div>
            <h2 class="text-2xl font-semibold text-white">Create your explorer password</h2>
            <p class="mt-2 text-sm text-white/60">
              Protect your workspace with a password only you know. You’ll use it every time you launch the app.
            </p>
          </div>

          <form class="space-y-6" @submit.prevent="handleSetupSubmit">
            <div class="space-y-4">
              <div>
                <label for="setup-password" class="block text-sm font-medium uppercase tracking-wide text-white/70">
                  Password
                </label>
                <input
                  id="setup-password"
                  v-model="setupPasswordValue"
                  type="password"
                  autocomplete="new-password"
                  :class="inputBaseClasses"
                  placeholder="Choose a strong password"
                  :disabled="isSubmittingSetup"
                />
              </div>

              <div>
                <label for="setup-password-confirm" class="block text-sm font-medium uppercase tracking-wide text-white/70">
                  Confirm Password
                </label>
                <input
                  id="setup-password-confirm"
                  v-model="setupConfirmValue"
                  type="password"
                  autocomplete="new-password"
                  :class="inputBaseClasses"
                  placeholder="Re-type your password"
                  :disabled="isSubmittingSetup"
                />
              </div>
            </div>

            <p v-if="setupError" :class="helperTextClasses">{{ setupError }}</p>
            <p v-else-if="statusError" :class="helperTextClasses">{{ statusError }}</p>

            <button type="submit" :class="buttonBaseClasses" :disabled="isSubmittingSetup">
              <span v-if="isSubmittingSetup">Securing…</span>
              <span v-else>Save Password</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

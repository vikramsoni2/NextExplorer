<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import HeaderLogo from '@/components/HeaderLogo.vue';
import { useAuthStore } from '@/stores/auth';


const version = __APP_VERSION__

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const loginPasswordValue = ref('');
const loginError = ref('');
const isSubmittingLogin = ref(false);

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
  () => auth.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) {
      redirectToDestination();
    }
  },
  { immediate: true },
);

watch(
  () => auth.requiresSetup,
  (requiresSetup) => {
    if (requiresSetup && auth.hasStatus) {
      const redirect = redirectTarget.value;
      router.replace({ name: 'auth-setup', ...(redirect ? { query: { redirect } } : {}) });
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
  loginError.value = '';
  auth.clearError();
};

const handleLoginSubmit = async () => {
  resetErrors();

  if (!loginPasswordValue.value) {
    loginError.value = 'Password is required.';
    return;
  }

  isSubmittingLogin.value = true;

  try {
    await auth.login(loginPasswordValue.value);
    loginPasswordValue.value = '';
    redirectToDestination();
  } catch (error) {
    loginError.value = error instanceof Error ? error.message : 'Failed to sign in.';
  } finally {
    isSubmittingLogin.value = false;
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
            <h2 class="text-2xl font-semibold text-white">Unlock your explorer</h2>
            <p class="mt-2 text-sm text-white/60">
              Enter your password to resume exploring your volumes and files.
            </p>
          </div>

          <form class="space-y-6" @submit.prevent="handleLoginSubmit">
            <div>
              <label for="login-password" class="block text-sm font-medium uppercase tracking-wide text-white/70">
                Password
              </label>
              <input
                id="login-password"
                v-model="loginPasswordValue"
                type="password"
                autocomplete="current-password"
                :class="inputBaseClasses"
                placeholder="Enter your password"
                :disabled="isSubmittingLogin"
              />
            </div>

            <p v-if="loginError" :class="helperTextClasses">{{ loginError }}</p>
            <p v-else-if="statusError" :class="helperTextClasses">{{ statusError }}</p>

            <button type="submit" :class="buttonBaseClasses" :disabled="isSubmittingLogin">
              <span v-if="isSubmittingLogin">Verifying…</span>
              <span v-else>Sign In</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

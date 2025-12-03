<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import AuthLayout from '@/layouts/AuthLayout.vue';
import { LockClosedIcon, KeyIcon } from '@heroicons/vue/24/outline';
import { apiBase } from '@/api';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useFeaturesStore } from '@/stores/features';

const auth = useAuthStore();
const featuresStore = useFeaturesStore();
const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const loginEmailValue = ref('');
const loginPasswordValue = ref('');
const loginError = ref('');
const isSubmittingLogin = ref(false);

const statusError = computed(() => auth.lastError || '');
const supportsLocal = computed(() => auth.strategies?.local !== false);
const supportsOidc = computed(() => Boolean(auth.strategies?.oidc));
const redirectTarget = computed(() => {
  const redirect = route.query?.redirect;
  if (typeof redirect === 'string' && redirect.trim()) {
    return redirect;
  }
  return '/browse/';
});

const inputBaseClasses =
  'mt-2 w-full h-12 rounded-xl ring-1 ring-inset ring-white/10 bg-neutral-800/70 px-4 text-neutral-100 placeholder-neutral-500 focus:ring-white/60 focus:outline-hidden transition';

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

onMounted(async () => {
  if (!auth.hasStatus && !auth.isLoading) {
    auth.initialize();
  }
  try {
    await featuresStore.ensureLoaded();
  } catch (_) {
    // Non-fatal; version info is optional
  }
});

const resetErrors = () => {
  loginError.value = '';
  auth.clearError();
};

const handleLoginSubmit = async () => {
  resetErrors();

  if (!supportsLocal.value) {
    loginError.value = t('errors.localSignInDisabled');
    return;
  }

  if (!loginEmailValue.value.trim()) {
    loginError.value = t('errors.emailRequired');
    return;
  }

  if (!loginPasswordValue.value) {
    loginError.value = t('errors.passwordRequired');
    return;
  }

  isSubmittingLogin.value = true;

  try {
    await auth.login({
      email: loginEmailValue.value.trim(),
      password: loginPasswordValue.value,
    });
    loginEmailValue.value = '';
    loginPasswordValue.value = '';
    redirectToDestination();
  } catch (error) {
    loginError.value = error instanceof Error ? error.message : t('errors.signIn');
  } finally {
    isSubmittingLogin.value = false;
  }
};

const handleOidcLogin = () => {
  resetErrors();
  const returnTo = redirectTarget.value;
  const base = apiBase || '';
  // Prefer EOC's native /login route; Vite proxies /login to backend in dev.
  const loginUrl = `${base}/login`;
  const finalUrl = returnTo && typeof returnTo === 'string'
    ? `${loginUrl}?returnTo=${encodeURIComponent(returnTo)}`
    : loginUrl;
  window.location.href = finalUrl;
};
</script>

<template>
  <AuthLayout :version="featuresStore.version" :is-loading="auth.isLoading">
    <template #heading>
      <p class="text-3xl font-black leading-tight tracking-tight text-white">
        {{ $t('auth.login.welcome') }}
      </p>
    </template>

    <template #subtitle>
      <p class="mt-2 text-sm text-white/60">{{ $t('auth.login.subtitle') }}</p>
    </template>

    <form v-if="supportsLocal" class="space-y-5" @submit.prevent="handleLoginSubmit">
      <label class="block">
        <span class="block text-sm font-medium text-white/80">{{ $t('auth.emailAddress') }}</span>
        <input
          id="login-email"
          v-model="loginEmailValue"
          type="email"
          autocomplete="email"
          :class="inputBaseClasses"
          :placeholder="$t('placeholders.emailCompany')"
          :disabled="isSubmittingLogin"
        />
      </label>

      <label class="block">
        <span class="block text-sm font-medium text-white/80">{{ $t('common.password') }}</span>
        <input
          id="login-password"
          v-model="loginPasswordValue"
          type="password"
          autocomplete="current-password"
          :class="inputBaseClasses"
          placeholder="••••••••"
          :disabled="isSubmittingLogin"
        />
        <div class="mt-2 mb-4 text-right">
          <!-- <button
            type="button"
            class="text-xs font-medium text-white/70 underline-offset-4 hover:text-white hover:underline"
            @click="showResetInfo = true"
          >
            Forgot password?
          </button> -->
        </div>
      </label>

      <p v-if="loginError" :class="helperTextClasses">{{ loginError }}</p>
      <p v-else-if="statusError" :class="helperTextClasses">{{ statusError }}</p>

      <button type="submit" 
      class="w-full h-12 px-4 rounded-xl 
      bg-neutral-100 hover:bg-neutral-100/90 active:bg-neutral-100/70  
      font-semibold text-neutral-900 
      disabled:cursor-not-allowed disabled:opacity-60" 
      :disabled="isSubmittingLogin">
        <span v-if="isSubmittingLogin">{{ $t('common.verifying') }}</span>
        <span v-else class="inline-flex items-center gap-2">
          <LockClosedIcon class="h-5 w-5" />
          {{ $t('auth.login.submit') }}
        </span>
      </button>
    </form>

    <div v-if="supportsLocal && supportsOidc" class="my-4 flex items-center gap-4">
      <div class="h-px w-full bg-white/10"></div>
      <span class="text-xs text-white/50">{{ $t('common.or') }}</span>
      <div class="h-px w-full bg-white/10"></div>
    </div>

    <div v-if="supportsOidc" class="mb-2">
      <button
        class="flex h-12 w-full items-center justify-center gap-2 rounded-xl 
        bg-neutral-700/50 hover:bg-neutral-700/70 active:bg-neutral-700/90 
        px-4 text-sm font-medium text-white ring-1 ring-inset ring-white/10 "
        type="button"
        @click="handleOidcLogin"
      >
        <KeyIcon class="h-5 w-5" />
        <span class="truncate">{{ $t('auth.sso.continue') }}</span>
      </button>
    </div>

    <p
      v-if="!supportsLocal && statusError"
      class="mt-4"
      :class="helperTextClasses"
    >
      {{ statusError }}
    </p>
  </AuthLayout>
</template>

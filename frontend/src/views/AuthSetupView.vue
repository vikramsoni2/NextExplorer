<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { LockClosedIcon } from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/auth';
import { useI18n } from 'vue-i18n';

const version = __APP_VERSION__

const auth = useAuthStore();
const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const setupEmailValue = ref('');
const setupUsernameValue = ref('');
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
  'mt-2 w-full h-12 rounded-lg ring-1 ring-inset ring-white/10 bg-zinc-800/30 px-4 text-neutral-100 placeholder-neutral-500 focus:ring-yellow-500/60 focus:outline-hidden transition';


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

  if (!setupEmailValue.value.trim()) {
    setupError.value = t('auth.errors.emailRequired');
    return;
  }

  if (setupPasswordValue.value.length < 6) {
    setupError.value = t('auth.errors.passwordLength');
    return;
  }

  if (setupPasswordValue.value !== setupConfirmValue.value) {
    setupError.value = t('auth.errors.passwordMismatch');
    return;
  }

  isSubmittingSetup.value = true;

  try {
    await auth.setupAccount({
      email: setupEmailValue.value.trim(),
      username: setupUsernameValue.value.trim() || setupEmailValue.value.trim().split('@')[0],
      password: setupPasswordValue.value,
    });
    setupEmailValue.value = '';
    setupUsernameValue.value = '';
    setupPasswordValue.value = '';
    setupConfirmValue.value = '';
    redirectToDestination();
  } catch (error) {
    setupError.value = error instanceof Error ? error.message : t('auth.errors.createAccountFailed');
  } finally {
    isSubmittingSetup.value = false;
  }
};
</script>

<template>
  <AuthLayout :version="version" :is-loading="auth.isLoading">
    <template #heading>
      <p class="text-3xl font-black leading-tight tracking-tight text-white">
        {{ $t('auth.setup.headline') }}
      </p>
    </template>

    <template #subtitle>
      <p class="mt-2 text-sm text-white/60">{{ $t('auth.setup.subtitle') }}</p>
    </template>


    <form class="space-y-5" @submit.prevent="handleSetupSubmit">
      <label class="block">
        <span class="block text-sm font-medium text-white/80">{{ $t('auth.email') }}</span>
        <input
          id="setup-email"
          v-model="setupEmailValue"
          type="email"
          autocomplete="email"
          :class="inputBaseClasses"
          :placeholder="$t('auth.emailPlaceholder')"
          :disabled="isSubmittingSetup"
        />
      </label>

      <label class="block">
        <span class="block text-sm font-medium text-white/80">{{ $t('auth.usernameOptional') }}</span>
        <input
          id="setup-username"
          v-model="setupUsernameValue"
          type="text"
          autocomplete="username"
          :class="inputBaseClasses"
          :placeholder="$t('auth.usernamePlaceholder')"
          :disabled="isSubmittingSetup"
        />
      </label>

      <label class="block">
        <span class="block text-sm font-medium text-white/80">{{ $t('auth.password') }}</span>
        <input
          id="setup-password"
          v-model="setupPasswordValue"
          type="password"
          autocomplete="new-password"
          :class="inputBaseClasses"
          :placeholder="$t('auth.passwordPlaceholder')"
          :disabled="isSubmittingSetup"
        />
      </label>

      <label class="block">
        <span class="block text-sm font-medium text-white/80">{{ $t('auth.confirmPassword') }}</span>
        <input
          id="setup-password-confirm"
          v-model="setupConfirmValue"
          type="password"
          autocomplete="new-password"
          :class="inputBaseClasses"
          :placeholder="$t('auth.confirmPasswordPlaceholder')"
          :disabled="isSubmittingSetup"
        />
      </label>

      <p v-if="setupError" :class="helperTextClasses">{{ setupError }}</p>
      <p v-else-if="statusError" :class="helperTextClasses">{{ statusError }}</p>

      <button type="submit" class=
      "w-full h-12 rounded-lg bg-accent px-4 font-semibold text-neutral-900 transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
      :disabled="isSubmittingSetup">
        <span v-if="isSubmittingSetup">{{ $t('auth.creating') }}</span>
        <span v-else class="inline-flex gap-2 items-center">
          <LockClosedIcon class="w-5 h-5" />
          {{ $t('auth.setup.submit') }}
        </span>
      </button>
    </form>
  </AuthLayout>
</template>

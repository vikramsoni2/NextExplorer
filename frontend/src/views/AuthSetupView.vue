<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { LockClosedIcon } from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/auth';
import { useFeaturesStore } from '@/stores/features';
import { useI18n } from 'vue-i18n';

const auth = useAuthStore();
const featuresStore = useFeaturesStore();
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
  'mt-2 w-full h-12 rounded-xl ring-1 ring-inset ring-white/10 bg-neutral-800/70 px-4 text-neutral-100 placeholder-neutral-500 focus:ring-white/60 focus:outline-hidden transition';

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

onMounted(async () => {
  if (!auth.hasStatus && !auth.isLoading) {
    auth.initialize();
  }
  try {
    await featuresStore.ensureLoaded();
  } catch (_) {
    // Non-fatal; version is optional
  }
});

const resetErrors = () => {
  setupError.value = '';
  auth.clearError();
};

const handleSetupSubmit = async () => {
  resetErrors();

  if (!setupEmailValue.value.trim()) {
    setupError.value = t('errors.emailRequired');
    return;
  }

  if (setupPasswordValue.value.length < 6) {
    setupError.value = t('errors.passwordLength');
    return;
  }

  if (setupPasswordValue.value !== setupConfirmValue.value) {
    setupError.value = t('errors.passwordMismatch');
    return;
  }

  isSubmittingSetup.value = true;

  try {
    await auth.setupAccount({
      email: setupEmailValue.value.trim(),
      username:
        setupUsernameValue.value.trim() ||
        setupEmailValue.value.trim().split('@')[0],
      password: setupPasswordValue.value,
    });
    setupEmailValue.value = '';
    setupUsernameValue.value = '';
    setupPasswordValue.value = '';
    setupConfirmValue.value = '';
    redirectToDestination();
  } catch (error) {
    setupError.value =
      error instanceof Error ? error.message : t('errors.createAccount');
  } finally {
    isSubmittingSetup.value = false;
  }
};
</script>

<template>
  <AuthLayout :version="featuresStore.version" :is-loading="auth.isLoading">
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
        <span class="block text-sm font-medium text-white/80">{{
          $t('auth.emailAddress')
        }}</span>
        <input
          id="setup-email"
          v-model="setupEmailValue"
          type="email"
          autocomplete="email"
          :class="inputBaseClasses"
          :placeholder="$t('placeholders.emailCompany')"
          :disabled="isSubmittingSetup"
        />
      </label>

      <label class="block">
        <span class="block text-sm font-medium text-white/80">{{
          $t('auth.usernameOptional')
        }}</span>
        <input
          id="setup-username"
          v-model="setupUsernameValue"
          type="text"
          autocomplete="username"
          :class="inputBaseClasses"
          :placeholder="$t('placeholders.username')"
          :disabled="isSubmittingSetup"
        />
      </label>

      <label class="block">
        <span class="block text-sm font-medium text-white/80">{{
          $t('common.password')
        }}</span>
        <input
          id="setup-password"
          v-model="setupPasswordValue"
          type="password"
          autocomplete="new-password"
          :class="inputBaseClasses"
          :placeholder="$t('placeholders.password')"
          :disabled="isSubmittingSetup"
        />
      </label>

      <label class="block">
        <span class="block text-sm font-medium text-white/80">{{
          $t('auth.confirmPassword')
        }}</span>
        <input
          id="setup-password-confirm"
          v-model="setupConfirmValue"
          type="password"
          autocomplete="new-password"
          :class="inputBaseClasses"
          :placeholder="$t('placeholders.confirmPassword')"
          :disabled="isSubmittingSetup"
        />
      </label>

      <p v-if="setupError" :class="helperTextClasses">{{ setupError }}</p>
      <p v-else-if="statusError" :class="helperTextClasses">
        {{ statusError }}
      </p>

      <button
        type="submit"
        class="w-full h-12 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-100/90 active:bg-neutral-100/70 font-semibold text-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="isSubmittingSetup"
      >
        <span v-if="isSubmittingSetup">{{ $t('common.creating') }}</span>
        <span v-else class="inline-flex items-center gap-2">
          <LockClosedIcon class="h-5 w-5" />
          {{ $t('auth.setup.submit') }}
        </span>
      </button>
    </form>
  </AuthLayout>
</template>

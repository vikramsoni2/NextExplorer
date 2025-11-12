<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import HeaderLogo from '@/components/HeaderLogo.vue';
import { LockClosedIcon } from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/auth';

const version = __APP_VERSION__

const auth = useAuthStore();
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
  'mt-2 w-full h-12 rounded-lg ring-1 ring-inset ring-white/10 bg-zinc-800/30 px-4 text-nextgray-100 placeholder-zinc-500 focus:ring-accent/60 focus:outline-none transition';

const buttonBaseClasses =
  'w-full h-12 rounded-lg bg-accent px-4 font-semibold text-nextzinc-900 transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60';

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
    setupError.value = 'Email is required.';
    return;
  }

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
    setupError.value = error instanceof Error ? error.message : 'Failed to create account.';
  } finally {
    isSubmittingSetup.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen bg-nextzinc-900 text-nextgray-100">
    <!-- Loading state covering screen -->
    <div v-if="auth.isLoading" class="flex min-h-screen items-center justify-center px-4 py-12">
      <div class="flex flex-col items-center gap-3">
        <div class="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-accent"></div>
        <p class="text-lg font-medium tracking-wide text-nextgray-100/80">Preparing your explorer…</p>
      </div>
    </div>

    <div v-else class="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <!-- Left: Highlights / Branding -->
      <section
        class="relative hidden md:flex flex-col justify-between border-r border-white/10 bg-gradient-to-br from-nextzinc-900 via-slateblue to-nextzinc-900 px-12 py-10 overflow-hidden"
      >
        <!-- subtle accent glow for depth -->
        <div class="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl"></div>
        <div class="flex items-center justify-between">
          <h1 class="mb-0 h-9 text-2xl font-bold tracking-tight text-white">
            <HeaderLogo appname="NextExplorer"/>
          </h1>
          <span class="inline-flex h-9 items-center rounded-full bg-white/5 px-3 text-xs font-semibold uppercase tracking-widest text-white/70">
            v{{ version }}
          </span>
        </div>

        <div class="max-w-xl">
          <h2 class="text-5xl font-semibold tracking-tight text-white">
            Let’s get <span class="text-accent">set up</span>
          </h2>
          <p class="mt-4 text-base leading-relaxed text-white/70">Create your administrator account to secure and manage your files.</p>
          <ul class="mt-8 space-y-3 text-sm text-white/80">
            <li class="flex items-center gap-3">
              <span class="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-accent"></span>
              Strong encryption and audit-friendly actions.
            </li>
            <li class="flex items-center gap-3">
              <span class="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-accent"></span>
              Granular permissions and user management.
            </li>
            <li class="flex items-center gap-3">
              <span class="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-accent"></span>
              Seamless Single Sign-On support.
            </li>
          </ul>
        </div>

        <div class="text-xs text-white/40">© {{ new Date().getFullYear() }} NextExplorer</div>
      </section>

      <!-- Right: Setup form -->
      <section class="flex items-center justify-center px-6 py-10">
        <div class="w-full max-w-md">
          <div class="mb-8 flex items-center justify-between md:hidden">
            <h1 class="mb-0 text-2xl font-bold tracking-tight text-white">NextExplorer</h1>
            <span class="inline-flex h-9 items-center rounded-full bg-white/5 px-3 text-xs font-semibold uppercase tracking-widest text-white/70">
              v{{ version }}
            </span>
          </div>
          <div class="mb-6">
            <p class="text-3xl font-black leading-tight tracking-tight text-white">Create your account</p>
            <p class="mt-2 text-sm text-white/60">Provide an email and secure password to finish setup.</p>
          </div>

          <form class="space-y-5" @submit.prevent="handleSetupSubmit">
            <label class="block">
              <span class="block text-sm font-medium text-white/80">Email address</span>
              <input
                id="setup-email"
                v-model="setupEmailValue"
                type="email"
                autocomplete="email"
                :class="inputBaseClasses"
                placeholder="name@company.com"
                :disabled="isSubmittingSetup"
              />
            </label>

            <label class="block">
              <span class="block text-sm font-medium text-white/80">Username (optional)</span>
              <input
                id="setup-username"
                v-model="setupUsernameValue"
                type="text"
                autocomplete="username"
                :class="inputBaseClasses"
                placeholder="Defaults to email prefix"
                :disabled="isSubmittingSetup"
              />
            </label>

            <label class="block">
              <span class="block text-sm font-medium text-white/80">Password</span>
              <input
                id="setup-password"
                v-model="setupPasswordValue"
                type="password"
                autocomplete="new-password"
                :class="inputBaseClasses"
                placeholder="Choose a strong password"
                :disabled="isSubmittingSetup"
              />
            </label>

            <label class="block">
              <span class="block text-sm font-medium text-white/80">Confirm password</span>
              <input
                id="setup-password-confirm"
                v-model="setupConfirmValue"
                type="password"
                autocomplete="new-password"
                :class="inputBaseClasses"
                placeholder="Re-type your password"
                :disabled="isSubmittingSetup"
              />
            </label>

            <p v-if="setupError" :class="helperTextClasses">{{ setupError }}</p>
            <p v-else-if="statusError" :class="helperTextClasses">{{ statusError }}</p>

            <button type="submit" :class="buttonBaseClasses" :disabled="isSubmittingSetup">
              <span v-if="isSubmittingSetup">Creating…</span>
              <span v-else class="inline-flex gap-2 items-center"> <LockClosedIcon class="w-5 h-5"/> Finish Setup</span>
            </button>
          </form>
        </div>
      </section>
    </div>
  </div>
</template>

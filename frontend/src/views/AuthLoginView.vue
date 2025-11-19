<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import HeaderLogo from '@/components/HeaderLogo.vue';
import ModalDialog from '@/components/ModalDialog.vue';
import { LockClosedIcon, KeyIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { useStorage } from '@vueuse/core';
import { apiBase } from '@/api';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useFeaturesStore } from '@/stores/features';

const version = __APP_VERSION__

const auth = useAuthStore();
const { t, locale } = useI18n();
const router = useRouter();
const route = useRoute();

const loginEmailValue = ref('');
const loginPasswordValue = ref('');
const loginError = ref('');
const isSubmittingLogin = ref(false);
const showResetInfo = ref(false);

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
  'mt-2 w-full h-12 rounded-lg ring-1 ring-inset ring-white/10 bg-zinc-800/30 px-4 text-nextgray-100 placeholder-zinc-500 focus:ring-accent/60 focus:outline-none transition';

const buttonBaseClasses =
  'w-full h-12 rounded-lg bg-accent px-4 font-semibold text-nextzinc-900 transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60';

const helperTextClasses = 'text-sm text-red-400';

// Announcements pulled from public features endpoint
const announcement = ref(null);
const hasAnnouncement = computed(() => Boolean(announcement.value));

// Announcement callout styles, tailored for dark login background
const LEVEL_BORDER = Object.freeze({
  info: 'border-blue-400/70',
  success: 'border-emerald-400/70',
  warning: 'border-amber-400/70',
  error: 'border-rose-400/70',
});
const LEVEL_ICON = Object.freeze({
  info: 'text-blue-300',
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  error: 'text-rose-300',
});

// Persist dismissal locally for the login route only
const dismissedOnLogin = useStorage('auth-login:announcements:dismissed', {});
const currentAnnouncementId = computed(() => String(announcement.value?.id || '__generic'));
const showAnnouncement = computed(() => hasAnnouncement.value && !dismissedOnLogin.value[currentAnnouncementId.value]);
const dismissAnnouncement = () => {
  const id = currentAnnouncementId.value;
  dismissedOnLogin.value = { ...(dismissedOnLogin.value || {}), [id]: true };
};

const availableLocaleOptions = [
  { code: 'en', label: 'i18n.english' },
  { code: 'es', label: 'i18n.spanish' },
  { code: 'fr', label: 'i18n.french' },
  { code: 'de', label: 'i18n.german' },
  { code: 'zh', label: 'i18n.chinese' },
  { code: 'hi', label: 'i18n.hindi' },
  { code: 'pl', label: 'i18n.polish' },
];

const languages = computed(() => availableLocaleOptions.map(({ code, label }) => ({
  code,
  label: t(label),
})));

function setLocale(lang) {
  try { localStorage.setItem('locale', lang); } catch (_) {}
  if (typeof document !== 'undefined') { document.documentElement.setAttribute('lang', lang); }
  locale.value = lang;
}

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
    const featuresStore = useFeaturesStore();
    await featuresStore.ensureLoaded();
    const anns = featuresStore.announcements || [];
    // Prefer the migration announcement if present; else show the first
    const mig = anns.find(a => a?.id === 'v3-user-migration');
    announcement.value = mig || anns[0] || null;
  } catch (_) {
    // Non-fatal; announcements are optional
  }
});

const resetErrors = () => {
  loginError.value = '';
  auth.clearError();
};

const handleLoginSubmit = async () => {
  resetErrors();

  if (!supportsLocal.value) {
    loginError.value = t('auth.errors.localSignInDisabled');
    return;
  }

  if (!loginEmailValue.value.trim()) {
    loginError.value = t('auth.errors.emailRequired');
    return;
  }

  if (!loginPasswordValue.value) {
    loginError.value = t('auth.errors.passwordRequired');
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
    loginError.value = error instanceof Error ? error.message : t('auth.errors.signInFailed');
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
  <div class="min-h-screen bg-nextzinc-900 text-nextgray-100">
    <!-- Loading state covering screen -->
    <div v-if="auth.isLoading" class="flex min-h-screen items-center justify-center px-4 py-12">
      <div class="flex flex-col items-center gap-3">
        <div class="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-accent"></div>
        <p class="text-lg font-medium tracking-wide text-nextgray-100/80">{{ $t('auth.preparing') }}</p>
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
          <h1 class="mb-0 text-2xl font-bold tracking-tight text-white">
            <HeaderLogo appname="NextExplorer"/>
          </h1>
          <span class="inline-flex h-9 items-center rounded-full bg-white/5 px-3 text-xs font-semibold uppercase tracking-widest text-white/70">
            v{{ version }}
          </span>
        </div>

        <div class="max-w-xl">
          <h2 class="text-5xl font-semibold tracking-tight text-white">
            {{ $t('auth.marketing.headline') }}
          </h2>
          <p class="mt-4 text-base leading-relaxed text-white/70">{{ $t('auth.marketing.subtitle') }}</p>
          <ul class="mt-8 space-y-3 text-sm text-white/80">
            <li class="flex items-center gap-3">
              <span class="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-accent"></span>
              {{ $t('auth.marketing.bullets.keyboard') }}
            </li>
            <li class="flex items-center gap-3">
              <span class="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-accent"></span>
              {{ $t('auth.marketing.bullets.access') }}
            </li>
            <li class="flex items-center gap-3">
              <span class="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-accent"></span>
              {{ $t('auth.marketing.bullets.sso') }}
            </li>
          </ul>
        </div>

        <div class="text-xs text-white/40">© {{ new Date().getFullYear() }} NextExplorer</div>
      </section>

      <!-- Right: Auth form -->
      <section class="flex items-center justify-center px-6 py-10">
        <div class="w-full max-w-md">
          <div class="mb-8 flex items-center justify-between md:hidden">
            
            <HeaderLogo appname="NextExplorer"/>
            
            <span class="inline-flex h-9 items-center rounded-full bg-white/5 px-3 text-xs font-semibold uppercase tracking-widest text-white/70">
              v{{ version }}
            </span>
          </div>
          <div class="mb-6">
            <p class="text-3xl font-black leading-tight tracking-tight text-white">{{ $t('auth.login.welcome') }}</p>
            <p class="mt-2 text-sm text-white/60">{{ $t('auth.login.subtitle') }}</p>
          </div>

          <!-- Inline announcement if available -->
          <div v-if="showAnnouncement" class="mb-6">
            <div
              class="relative rounded-xl px-4 py-4 ring-1 ring-inset ring-white/10 bg-white/5 border-l-4 shadow-lg shadow-black/30"
              :class="LEVEL_BORDER[announcement.level] || LEVEL_BORDER.info"
              aria-live="polite"
            >
              <button
                type="button"
                class="absolute right-2 top-2 p-1 rounded-md text-white/60 hover:text-white/90 hover:bg-white/10"
                :aria-label="$t('common.dismiss')"
                @click="dismissAnnouncement"
              >
                <XMarkIcon class="h-4 w-4" />
              </button>
              <div class="flex items-start gap-3">
                <InformationCircleIcon class="h-6 w-6 mt-0.5 flex-shrink-0" :class="LEVEL_ICON[announcement.level] || LEVEL_ICON.info" />
                <div class="flex-1">
                  <h3 v-if="announcement.title" class="font-semibold text-blue-300 mb-2">
                    <span v-if="announcement.id === 'v3-user-migration'">
                      {{ $t('auth.login.announcementMigration.title') }}
                    </span>
                    <span v-else>
                      {{ announcement.title }}
                    </span>
                  </h3>
                  <div class="text-sm text-white/80 leading-relaxed whitespace-pre-line">
                    <template v-if="announcement.id === 'v3-user-migration'">
                      <p class="-ml-6">
                        {{ $t('auth.login.announcementMigration.intro') }}
                      </p>
                      <ul class="list-disc">
                        <li>
                          <span
                            v-html="$t('auth.login.announcementMigration.bulletAddSuffix', { suffix: '<span class=&quot;px-2 font-bold text-yellow-300&quot;>@example.local</span>' })"
                          />
                        </li>
                        <li>
                          {{ $t('auth.login.announcementMigration.bulletPasswordSame') }}
                        </li>
                        <li>
                          {{ $t('auth.login.announcementMigration.bulletUpdateUsers') }}
                        </li>
                      </ul>
                    </template>
                    <template v-else>
                      <p>
                        {{ announcement.message }}
                      </p>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- SSO first, minimal outlined button -->
          

          <!-- Email/password form -->
          <form v-if="supportsLocal" class="space-y-5" @submit.prevent="handleLoginSubmit">
            <label class="block">
              <span class="block text-sm font-medium text-white/80">{{ $t('auth.email') }}</span>
              <input
                id="login-email"
                v-model="loginEmailValue"
                type="email"
                autocomplete="email"
                :class="inputBaseClasses"
                :placeholder="$t('auth.emailPlaceholder')"
                :disabled="isSubmittingLogin"
              />
            </label>

            <label class="block">
              <span class="block text-sm font-medium text-white/80">{{ $t('auth.password') }}</span>
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

            <button type="submit" :class="buttonBaseClasses" :disabled="isSubmittingLogin">
              <span v-if="isSubmittingLogin">{{ $t('auth.verifying') }}</span>
              <span v-else class="inline-flex gap-2 items-center"> <LockClosedIcon class="w-5 h-5"/> {{ $t('auth.login.submit') }}</span>
            </button>
          </form>
           <div v-if="supportsLocal && supportsOidc" class="my-4 flex items-center gap-4">
            <div class="h-px w-full bg-white/10"></div>
            <span class="text-xs text-white/50">{{ $t('common.or') }}</span>
            <div class="h-px w-full bg-white/10"></div>
          </div>
          <div v-if="supportsOidc" class="mb-6">
            <button
              class="flex w-full items-center justify-center gap-2 h-12 px-4 rounded-lg ring-1 ring-inset ring-white/10 bg-neutral-700/40 text-white text-sm font-medium hover:bg-white/10"
              type="button"
              @click="handleOidcLogin"
            >
              <KeyIcon class="h-5 w-5" />
              <span class="truncate">{{ $t('auth.sso.continue') }}</span>
            </button>
          </div>

         

          <p v-if="!supportsLocal && statusError" class="mt-4" :class="helperTextClasses">{{ statusError }}</p>
        </div>
      </section>
    </div>

    <!-- Reset password info modal -->
    <!-- <ModalDialog v-model="showResetInfo">
      <template #title>Reset password</template>
      <p class="text-white/80">
        Password reset is managed by your administrator or identity provider. If you use Single Sign-On, use your
        organization’s reset flow. Otherwise, contact your administrator to reset your password.
      </p>
    </ModalDialog> -->

    <!-- Language switcher (login only) -->
    <div class="py-3 text-center text-white/70 text-xs w-1/2 fixed bottom-0 right-0">
      <span class="mr-2">{{ $t('i18n.language') }}:</span>
      <template v-for="(lang, idx) in languages" :key="lang.code">
        <button
          type="button"
          class="px-2 py-1 rounded hover:bg-white/10"
          :class="{ 'bg-white/10 font-semibold': $i18n.locale === lang.code }"
          @click="setLocale(lang.code)"
        >
          {{ lang.label }}
        </button>
        <span v-if="idx < languages.length - 1" class="mx-2">•</span>
      </template>
    </div>
  </div>
</template>

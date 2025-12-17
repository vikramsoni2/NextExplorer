<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import {
  getShareInfo,
  verifySharePassword,
  accessShare,
  setGuestSession,
} from '@/api/shares.api';
import {
  ShareIcon,
  LockClosedIcon,
  ClockIcon,
  FolderIcon,
  DocumentIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline';
import LoadingIcon from '@/icons/LoadingIcon.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const shareToken = computed(() => route.params.token || '');

// State
const loading = ref(true);
const shareInfo = ref(null);
const error = ref('');
const password = ref('');
const isVerifying = ref(false);
const verificationError = ref('');

// Computed
const isExpired = computed(() => shareInfo.value?.isExpired || false);
const requiresPassword = computed(() => Boolean(shareInfo.value?.hasPassword && shareInfo.value?.sharingType === 'anyone'));
const expiryDate = computed(() => {
  if (!shareInfo.value?.expiresAt) return null;
  return new Date(shareInfo.value.expiresAt);
});

onMounted(async () => {
  await loadShareInfo();
});

async function loadShareInfo() {
  loading.value = true;
  error.value = '';

  console.log('[DEBUG] Loading share info for token:', shareToken.value);

  try {
    const info = await getShareInfo(shareToken.value);
    console.log('[DEBUG] Share info loaded:', info);
    shareInfo.value = info;

    // If share doesn't require password and is public, auto-access
    if (!info.hasPassword && info.sharingType === 'anyone' && !info.isExpired) {
      console.log('[DEBUG] Auto-accessing share (no password required)');
      await handleAutoAccess();
    }

    // If this is a user-specific share and the user is already authenticated,
    // auto-access so share links work end-to-end.
    if (info.sharingType === 'users' && !info.isExpired) {
      if (!auth.hasStatus && !auth.isLoading) {
        await auth.initialize();
      } else if (auth.isLoading) {
        await auth.initialize();
      }

      if (auth.isAuthenticated) {
        await handleUserAccess();
      }
    }
  } catch (err) {
    console.error('[DEBUG] Failed to load share info:', err);
    error.value = err.message || 'Failed to load share information';
  } finally {
    loading.value = false;
  }
}

async function handleUserAccess() {
  try {
    await accessShare(shareToken.value);
    router.push({
      name: 'FolderView',
      params: { path: `share/${shareToken.value}` },
    });
  } catch (err) {
    console.error('[DEBUG] User access failed:', err);
    error.value = err.message || 'Failed to access share';
  }
}

async function handleAutoAccess() {
  console.log('[DEBUG] handleAutoAccess called');

  try {
    const result = await accessShare(shareToken.value);
    console.log('[DEBUG] Access result:', result);

    if (result.guestSessionId) {
      console.log('[DEBUG] Setting guest session:', result.guestSessionId);
      setGuestSession(result.guestSessionId);
    }

    const targetPath = `share/${shareToken.value}`;
    console.log('[DEBUG] Redirecting to FolderView with path:', targetPath);

    // Redirect to browse the share
    router.push({
      name: 'FolderView',
      params: { path: targetPath },
    });
  } catch (err) {
    console.error('[DEBUG] Auto-access failed:', err);
    error.value = err.message || 'Failed to access share';
  }
}

async function handlePasswordSubmit() {
  if (!password.value) {
    verificationError.value = t('errors.pleaseEnterPassword');
    return;
  }

  isVerifying.value = true;
  verificationError.value = '';

  console.log('[DEBUG] Verifying password for share:', shareToken.value);

  try {
    const result = await verifySharePassword(shareToken.value, password.value);
    console.log('[DEBUG] Password verification result:', result);

    if (result.success) {
      if (result.guestSessionId) {
        console.log('[DEBUG] Setting guest session:', result.guestSessionId);
        setGuestSession(result.guestSessionId);
      }

      const targetPath = `share/${shareToken.value}`;
      console.log('[DEBUG] Redirecting to FolderView with path:', targetPath);

      // Redirect to browse the share
      router.push({
        name: 'FolderView',
        params: { path: targetPath },
      });
    } else if (result.requiresAuth) {
      // User-specific share with password - redirect to login
      console.log('[DEBUG] Redirecting to login (requires auth)');
      router.push({
        name: 'auth-login',
        query: { redirect: `/share/${shareToken.value}` },
      });
    }
  } catch (err) {
    console.error('[DEBUG] Password verification failed:', err);
    verificationError.value = err.message || t('errors.invalidPassword');
  } finally {
    isVerifying.value = false;
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-900">
    <div class="w-full max-w-md p-8 mx-4">
      <!-- Loading State -->
      <div v-if="loading" class="text-center">
        <LoadingIcon class="w-12 h-12 mx-auto mb-4 text-blue-600 animate-spin" />
        <p class="text-gray-600 dark:text-gray-400">{{ t('loading.share') }}</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center">
        <ExclamationTriangleIcon class="w-16 h-16 mx-auto mb-4 text-red-500" />
        <h2 class="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          {{ t('share.shareNotFound') }}
        </h2>
        <p class="mb-6 text-gray-600 dark:text-gray-400">{{ error }}</p>
        <button
          @click="router.push('/')"
          class="px-6 py-2 text-white transition bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          {{ t('share.goToHome') }}
        </button>
      </div>

      <!-- Expired Share -->
      <div v-else-if="isExpired" class="text-center">
        <ClockIcon class="w-16 h-16 mx-auto mb-4 text-orange-500" />
        <h2 class="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          {{ t('share.shareExpired') }}
        </h2>
        <p class="mb-6 text-gray-600 dark:text-gray-400">
          {{ t('share.shareExpiredMessage') }}
        </p>
        <button
          @click="router.push('/')"
          class="px-6 py-2 text-white transition bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          {{ t('share.goToHome') }}
        </button>
      </div>

      <!-- Share Info & Access -->
      <div v-else class="p-8 bg-white rounded-lg shadow-lg dark:bg-zinc-800">
        <!-- Header -->
        <div class="mb-6 text-center">
          <div class="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full dark:bg-blue-900">
            <ShareIcon class="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 class="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {{ shareInfo.isDirectory ? t('share.sharedFolder') : t('share.sharedFile') }}
          </h2>
          <p v-if="shareInfo.label" class="text-lg text-gray-700 dark:text-gray-300">
            {{ shareInfo.label }}
          </p>
        </div>

        <!-- Share Details -->
        <div class="p-4 mb-6 space-y-3 rounded-lg bg-gray-50 dark:bg-zinc-700">
          <div class="flex items-center gap-3 text-sm">
            <component
              :is="shareInfo.isDirectory ? FolderIcon : DocumentIcon"
              class="w-5 h-5 text-gray-500 dark:text-gray-400"
            />
            <span class="text-gray-600 dark:text-gray-300">
              {{ shareInfo.isDirectory ? t('common.folder') : t('folder.kind') }}
            </span>
          </div>

          <div v-if="shareInfo.expiresAt" class="flex items-center gap-3 text-sm">
            <ClockIcon class="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <span class="text-gray-600 dark:text-gray-300">
              {{ t('share.expiresAt') }} {{ expiryDate.toLocaleDateString() }} at {{ expiryDate.toLocaleTimeString() }}
            </span>
          </div>

          <div v-if="requiresPassword" class="flex items-center gap-3 text-sm">
            <LockClosedIcon class="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <span class="text-gray-600 dark:text-gray-300">
              {{ t('common.passwordProtected') }}
            </span>
          </div>
        </div>

        <!-- Password Input (if required) -->
        <div v-if="requiresPassword" class="space-y-4">
          <div>
            <label class="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ t('share.enterPassword') }}
            </label>
            <input
              v-model="password"
              type="password"
              :placeholder="t('common.password')"
              @keyup.enter="handlePasswordSubmit"
              class="w-full px-4 py-2 border rounded-lg border-zinc-300 dark:border-zinc-600 dark:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div v-if="verificationError" class="p-3 text-sm text-red-700 rounded-lg bg-red-50 dark:bg-red-900/20 dark:text-red-200">
            {{ verificationError }}
          </div>

          <button
            @click="handlePasswordSubmit"
            :disabled="isVerifying || !password"
            class="w-full px-6 py-3 font-medium text-white transition bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isVerifying ? t('common.verifying') : t('share.accessShare') }}
          </button>
        </div>

        <!-- User-specific share message -->
        <div v-else-if="shareInfo.sharingType === 'users'" class="space-y-4">
          <p class="text-sm text-center text-gray-600 dark:text-gray-400">
            {{ t('share.requiresAuthentication') }}
          </p>
          <button
            v-if="auth.isAuthenticated"
            @click="handleUserAccess"
            class="w-full px-6 py-3 font-medium text-white transition bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            {{ t('share.accessShare') }}
          </button>
          <button
            v-else
            @click="router.push({ name: 'auth-login', query: { redirect: `/share/${shareToken}` } })"
            class="w-full px-6 py-3 font-medium text-white transition bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            {{ t('share.signInToAccess') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

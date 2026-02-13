<script setup>
import { ref } from 'vue';
import { changePassword } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useI18n } from 'vue-i18n';

const auth = useAuthStore();
const { t } = useI18n();
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const successMsg = ref('');
const errorMsg = ref('');
const busy = ref(false);

const canChangePassword = () => {
  if (!auth.currentUser) return false;
  if (auth.currentUser.provider !== 'local') return false;
  return true;
};

const validatePasswordFields = () => {
  if (!currentPassword.value) return { valid: false, message: t('errors.pleaseEnterPassword') };
  if (!newPassword.value || newPassword.value.length < 6)
    return { valid: false, message: t('errors.passwordMin') };
  if (newPassword.value !== confirmPassword.value)
    return { valid: false, message: t('errors.passwordMismatch') };
  return { valid: true, message: null };
};

const submit = async () => {
  successMsg.value = '';
  errorMsg.value = '';

  if (!canChangePassword()) {
    return;
  }

  const validation = validatePasswordFields();
  if (!validation.valid) {
    errorMsg.value = validation.message;
    return;
  }

  busy.value = true;
  try {
    await changePassword({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    });
    successMsg.value = t('settings.password.success');
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
  } catch (e) {
    errorMsg.value = e?.message || t('errors.changePassword');
  } finally {
    busy.value = false;
  }
};
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h2 class="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        {{ t('titles.changePassword') }}
      </h2>
      <p
        v-if="auth.currentUser?.provider !== 'local'"
        class="text-sm text-zinc-500 dark:text-zinc-400 mt-1"
      >
        {{ t('settings.password.notLocalUser') }}
      </p>
    </div>

    <!-- Content -->
    <div
      v-if="auth.currentUser?.provider === 'local'"
      class="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6"
    >
      <form class="space-y-6 max-w-md" @submit.prevent="submit">
        <div
          v-if="errorMsg"
          class="p-4 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md text-sm"
        >
          {{ errorMsg }}
        </div>
        <div
          v-if="successMsg"
          class="p-4 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md text-sm"
        >
          {{ successMsg }}
        </div>

        <div>
          <label
            for="current-password"
            class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
          >
            {{ t('settings.password.current') }}
          </label>
          <input
            id="current-password"
            v-model="currentPassword"
            type="password"
            class="block w-full rounded-md border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs focus:border-zinc-500 focus:ring-zinc-500 sm:text-sm p-2 border"
            autocomplete="current-password"
            :placeholder="t('placeholders.password')"
          />
        </div>
        <div>
          <label
            for="new-password"
            class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
          >
            {{ t('settings.password.new') }}
          </label>
          <input
            id="new-password"
            v-model="newPassword"
            type="password"
            class="block w-full rounded-md border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs focus:border-zinc-500 focus:ring-zinc-500 sm:text-sm p-2 border"
            autocomplete="new-password"
            :placeholder="t('placeholders.password')"
          />
          <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {{ t('errors.passwordMin') }}
          </p>
        </div>
        <div>
          <label
            for="confirm-password"
            class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
          >
            {{ t('settings.password.confirm') }}
          </label>
          <input
            id="confirm-password"
            v-model="confirmPassword"
            type="password"
            class="block w-full rounded-md border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs focus:border-zinc-500 focus:ring-zinc-500 sm:text-sm p-2 border"
            autocomplete="new-password"
            :placeholder="t('placeholders.confirmPassword')"
          />
        </div>
        <div class="flex gap-3 items-center pt-2">
          <button
            type="submit"
            class="inline-flex justify-center rounded-md border border-transparent bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50"
            :disabled="busy"
          >
            {{ busy ? t('common.updating') : t('settings.password.update') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

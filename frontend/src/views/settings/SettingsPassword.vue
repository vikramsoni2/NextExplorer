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
  if (!currentPassword.value)
    return { valid: false, message: t('settings.password.rules.currentRequired') };
  if (!newPassword.value || newPassword.value.length < 6)
    return { valid: false, message: t('settings.password.rules.length') };
  if (newPassword.value !== confirmPassword.value)
    return { valid: false, message: t('settings.password.rules.match') };
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
  <div class="space-y-4">
    <section class="rounded-lg p-4">
      <h2 class="mb-2 text-base font-semibold">{{ t('titles.changePassword') }}</h2>
      <p class="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        {{ t('settings.password.subtitle') }}
      </p>
      <div
        v-if="!canChangePassword()"
        class="max-w-md mb-4 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200/50 dark:border-orange-800/50"
      >
        <p class="text-sm text-orange-700 dark:text-orange-300">
          {{ t('settings.password.notLocalUser') }}
        </p>
      </div>

      <!-- Success Message -->
      <div
        v-if="successMsg"
        class="max-w-md mb-4 p-3 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-200/20 dark:border-green-800/20"
      >
        <p class="text-sm font-medium text-green-700 dark:text-green-300">{{ successMsg }}</p>
      </div>

      <!-- Error Message -->
      <div
        v-if="errorMsg"
        class="max-w-md mb-4 p-3 rounded-lg bg-gradient-to-r from-red-500/10 to-rose-500/10 border border-red-200/20 dark:border-red-800/20"
      >
        <p class="text-sm font-medium text-red-700 dark:text-red-300">{{ errorMsg }}</p>
      </div>

      <form v-if="canChangePassword()" class="space-y-3 max-w-md" @submit.prevent="submit">
        <div>
          <div class="mb-3">
            <label for="current-password" class="block text-sm font-medium">
              {{ t('settings.password.current') }}
            </label>
          </div>
          <input
            id="current-password"
            v-model="currentPassword"
            type="password"
            autocomplete="current-password"
            :placeholder="t('placeholders.currentPassword')"
            class="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </div>

        <div>
          <div class="mb-3">
            <label for="new-password" class="block text-sm font-medium">
              {{ t('settings.password.new') }}
            </label>
          </div>
          <input
            id="new-password"
            v-model="newPassword"
            type="password"
            autocomplete="new-password"
            :placeholder="t('placeholders.password')"
            class="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </div>

        <div>
          <div class="mb-3">
            <label for="confirm-password" class="block text-sm font-medium">
              {{ t('settings.password.confirm') }}
            </label>
          </div>
          <input
            id="confirm-password"
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            :placeholder="t('placeholders.confirmPassword')"
            class="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </div>

        <div class="mt-6">
          <button
            type="submit"
            :disabled="busy"
            class="cursor-pointer inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-md hover:bg-zinc-800 focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:bg-neutral-300 disabled:text-neutral-500 disabled:cursor-not-allowed disabled:hover:bg-neutral-300 dark:disabled:bg-neutral-700 dark:disabled:text-neutral-500 dark:disabled:hover:bg-neutral-700"
          >
            {{ busy ? t('common.updating') : t('settings.password.update') }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

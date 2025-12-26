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

const canSubmit = () => {
  if (!auth.currentUser) return false;
  if (auth.currentUser.provider !== 'local') return false;
  return (
    newPassword.value &&
    newPassword.value.length >= 6 &&
    newPassword.value === confirmPassword.value &&
    currentPassword.value
  );
};

const submit = async () => {
  successMsg.value = '';
  errorMsg.value = '';
  if (!canSubmit()) {
    errorMsg.value = t('settings.password.validation');
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
    <h2 class="text-lg font-semibold">{{ t('titles.changePassword') }}</h2>
    <p v-if="auth.currentUser?.provider !== 'local'" class="text-sm opacity-75">
      {{ t('settings.password.notLocalUser') }}
    </p>
    <form v-else class="space-y-3 max-w-md" @submit.prevent="submit">
      <div>
        <label class="block text-sm mb-1">{{
          t('settings.password.current')
        }}</label>
        <input
          v-model="currentPassword"
          type="password"
          class="w-full rounded-sm border border-white/10 bg-transparent px-3 py-2"
          autocomplete="current-password"
        />
      </div>
      <div>
        <label class="block text-sm mb-1">{{
          t('settings.password.new')
        }}</label>
        <input
          v-model="newPassword"
          type="password"
          class="w-full rounded-sm border border-white/10 bg-transparent px-3 py-2"
          autocomplete="new-password"
        />
      </div>
      <div>
        <label class="block text-sm mb-1">{{
          t('settings.password.confirm')
        }}</label>
        <input
          v-model="confirmPassword"
          type="password"
          class="w-full rounded-sm border border-white/10 bg-transparent px-3 py-2"
          autocomplete="new-password"
        />
      </div>
      <div class="flex gap-3 items-center">
        <button
          type="submit"
          class="rounded-sm bg-accent text-black px-4 py-2 disabled:opacity-50"
          :disabled="busy || !canSubmit()"
        >
          {{ busy ? t('common.updating') : t('settings.password.update') }}
        </button>
        <span v-if="successMsg" class="text-green-500 text-sm">{{
          successMsg
        }}</span>
        <span v-else-if="errorMsg" class="text-red-500 text-sm">{{
          errorMsg
        }}</span>
      </div>
    </form>
  </div>
</template>

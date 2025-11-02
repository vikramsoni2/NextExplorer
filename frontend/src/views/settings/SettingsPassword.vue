<script setup>
import { ref } from 'vue';
import { changePassword } from '@/api';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const successMsg = ref('');
const errorMsg = ref('');
const busy = ref(false);

const canSubmit = () => {
  if (!auth.currentUser) return false;
  if (auth.currentUser.provider !== 'local') return false;
  return newPassword.value && newPassword.value.length >= 6 && newPassword.value === confirmPassword.value && currentPassword.value;
};

const submit = async () => {
  successMsg.value = '';
  errorMsg.value = '';
  if (!canSubmit()) {
    errorMsg.value = 'Please fill all fields; new password must be at least 6 characters and match confirmation.';
    return;
  }
  busy.value = true;
  try {
    await changePassword({ currentPassword: currentPassword.value, newPassword: newPassword.value });
    successMsg.value = 'Password updated successfully.';
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
  } catch (e) {
    errorMsg.value = e?.message || 'Failed to change password';
  } finally {
    busy.value = false;
  }
};
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">Change Password</h2>
    <p v-if="auth.currentUser?.provider !== 'local'" class="text-sm opacity-75">
      Password can only be changed for local users. Your account is managed by your identity provider.
    </p>
    <form v-else class="space-y-3 max-w-md" @submit.prevent="submit">
      <div>
        <label class="block text-sm mb-1">Current password</label>
        <input v-model="currentPassword" type="password" class="w-full rounded border border-white/10 bg-transparent px-3 py-2" autocomplete="current-password" />
      </div>
      <div>
        <label class="block text-sm mb-1">New password</label>
        <input v-model="newPassword" type="password" class="w-full rounded border border-white/10 bg-transparent px-3 py-2" autocomplete="new-password" />
      </div>
      <div>
        <label class="block text-sm mb-1">Confirm new password</label>
        <input v-model="confirmPassword" type="password" class="w-full rounded border border-white/10 bg-transparent px-3 py-2" autocomplete="new-password" />
      </div>
      <div class="flex gap-3 items-center">
        <button type="submit" class="rounded bg-accent text-black px-4 py-2 disabled:opacity-50" :disabled="busy || !canSubmit()">
          {{ busy ? 'Updating…' : 'Update Password' }}
        </button>
        <span v-if="successMsg" class="text-green-500 text-sm">{{ successMsg }}</span>
        <span v-else-if="errorMsg" class="text-red-500 text-sm">{{ errorMsg }}</span>
      </div>
    </form>
  </div>
</template>


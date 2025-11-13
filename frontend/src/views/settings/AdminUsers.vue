<script setup>
import { onMounted, ref } from 'vue';
import { fetchUsers, updateUserRoles, createUser, adminSetUserPassword, deleteUser } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useI18n } from 'vue-i18n';

const auth = useAuthStore();
const { t } = useI18n();
const users = ref([]);
const loading = ref(false);
const errorMsg = ref('');

// Create user form state
const showCreate = ref(false);
const newEmail = ref('');
const newUsername = ref('');
const newPassword = ref('');
const newIsAdmin = ref(false);
const creating = ref(false);

const loadUsers = async () => {
  loading.value = true;
  errorMsg.value = '';
  try {
    const res = await fetchUsers();
    users.value = Array.isArray(res?.users) ? res.users : [];
  } catch (e) {
    errorMsg.value = e?.message || t('settings.users.failedLoad');
  } finally {
    loading.value = false;
  }
};

const grantAdmin = async (u) => {
  const nextRoles = Array.from(new Set([...(u.roles || []), 'admin']));
  try {
    const res = await updateUserRoles(u.id, nextRoles);
    const updated = res?.user;
    users.value = users.value.map((it) => (it.id === u.id ? updated : it));
  } catch (e) {
    alert(e?.message || t('settings.users.failedUpdateRoles'));
  }
};

const handleCreate = async () => {
  if (!newEmail.value.trim()) {
    alert(t('auth.errors.emailRequired'));
    return;
  }
  if (newPassword.value.length < 6) {
    alert(t('settings.users.passwordMin'));
    return;
  }
  creating.value = true;
  try {
    const res = await createUser({
      email: newEmail.value.trim(),
      username: newUsername.value.trim() || newEmail.value.trim().split('@')[0],
      password: newPassword.value,
      roles: newIsAdmin.value ? ['admin'] : []
    });
    if (res?.user) {
      users.value = users.value.concat([res.user]);
    }
    // reset form
    newEmail.value = '';
    newUsername.value = '';
    newPassword.value = '';
    newIsAdmin.value = false;
    showCreate.value = false;
  } catch (e) {
    alert(e?.message || t('settings.users.failedCreate'));
  } finally {
    creating.value = false;
  }
};

const handleResetPassword = async (u) => {
  const pwd = window.prompt(t('settings.users.promptNewPassword', { user: u.username }));
  if (pwd == null) return; // cancelled
  if (pwd.length < 6) {
    alert(t('settings.users.passwordMin'));
    return;
  }
  try {
    await adminSetUserPassword(u.id, pwd);
    alert(t('settings.users.passwordUpdated'));
  } catch (e) {
    alert(e?.message || t('settings.users.failedReset'));
  }
};

const handleDeleteUser = async (u) => {
  if (u.id === auth.currentUser?.id) {
    alert(t('settings.users.cannotDeleteSelf'));
    return;
  }
  const ok = window.confirm(t('settings.users.confirmRemove', { user: u.username }));
  if (!ok) return;
  try {
    await deleteUser(u.id);
    users.value = users.value.filter((it) => it.id !== u.id);
  } catch (e) {
    alert(e?.message || t('settings.users.failedRemove'));
  }
};

onMounted(() => { loadUsers(); });
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-3">
      <h2 class="text-lg font-semibold">{{ t('settings.users.title') }}</h2>
      <span v-if="loading" class="text-sm opacity-75">{{ t('common.loading') }}…</span>
      <div class="ml-auto">
        <button class="rounded-md bg-blue-500 px-3 py-1 text-white hover:bg-blue-400" @click="showCreate = !showCreate">
          {{ showCreate ? t('common.cancel') : t('settings.users.createUser') }}
        </button>
      </div>
    </div>
    <p v-if="errorMsg" class="text-sm text-red-500">{{ errorMsg }}</p>

    <section v-if="showCreate" class="rounded-lg border border-white/10 bg-white/5 p-4 dark:bg-zinc-900/50">
      <h3 class="mb-2 text-base font-semibold">{{ t('settings.users.createUser') }}</h3>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label class="block text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{{ t('settings.users.email') }} *</label>
          <input v-model.trim="newEmail" type="email" :placeholder="t('settings.users.emailPlaceholder')" class="w-full rounded-md border border-white/10 bg-transparent px-2 py-1" />
        </div>
        <div>
          <label class="block text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{{ t('settings.users.username') }}</label>
          <input v-model.trim="newUsername" :placeholder="t('settings.users.usernameOptional')" class="w-full rounded-md border border-white/10 bg-transparent px-2 py-1" />
        </div>
        <div>
          <label class="block text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{{ t('settings.users.password') }} *</label>
          <input v-model="newPassword" type="password" placeholder="••••••" class="w-full rounded-md border border-white/10 bg-transparent px-2 py-1" />
        </div>
        <div class="flex items-end">
          <label class="inline-flex items-center gap-2">
            <input type="checkbox" v-model="newIsAdmin" />
            <span>{{ t('settings.users.grantAdmin') }}</span>
          </label>
        </div>
      </div>
      <div class="mt-3">
        <button :disabled="creating" class="rounded-md bg-green-600 px-3 py-1 text-white hover:bg-green-500 disabled:opacity-60" @click="handleCreate">
          {{ creating ? t('settings.users.creating') : t('common.create') }}
        </button>
      </div>
    </section>

    <div class="overflow-x-auto rounded border border-white/10">
      <table class="w-full text-left text-sm">
        <thead class="bg-white/5">
          <tr>
            <th class="px-3 py-2">{{ t('settings.users.email') }}</th>
            <th class="px-3 py-2">{{ t('settings.users.username') }}</th>
            <th class="px-3 py-2">{{ t('settings.users.displayName') }}</th>
            <th class="px-3 py-2">{{ t('settings.users.roles') }}</th>
            <th class="px-3 py-2">{{ t('settings.users.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id" class="border-t border-white/5">
            <td class="px-3 py-2">{{ u.email }}</td>
            <td class="px-3 py-2">{{ u.username || '—' }}</td>
            <td class="px-3 py-2">{{ u.displayName || '—' }}</td>
            <td class="px-3 py-2">{{ (u.roles || []).join(', ') || '—' }}</td>
            <td class="px-3 py-2 space-x-2">
              <button
                v-if="!(u.roles || []).includes('admin')"
                class="rounded px-3 py-1 text-sm border border-white/20 hover:bg-white/10"
                @click="grantAdmin(u)"
              >
                {{ t('settings.users.makeAdmin') }}
              </button>

              <button
                class="rounded px-3 py-1 text-sm border border-white/20 hover:bg-white/10"
                @click="handleResetPassword(u)"
              >
                {{ t('settings.users.resetPassword') }}
              </button>

              <button
                v-if="u.id !== auth.currentUser?.id"
                class="rounded px-3 py-1 text-sm border border-red-400 text-red-300 hover:bg-red-500/10"
                @click="handleDeleteUser(u)"
              >
                {{ t('settings.users.removeUser') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

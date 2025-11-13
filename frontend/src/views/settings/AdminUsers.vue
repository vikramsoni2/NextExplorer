<script setup>
import { onMounted, ref } from 'vue';
import {
  fetchUsers,
  updateUserRoles,
  updateUser,
  createUser,
  adminSetUserPassword,
  deleteUser
} from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useI18n } from 'vue-i18n';

const auth = useAuthStore();
const { t } = useI18n();
const users = ref([]);
const loading = ref(false);
const errorMsg = ref('');

const showCreateModal = ref(false);
const showEditModal = ref(false);
const editUser = ref(null);
const editEmail = ref('');
const editUsername = ref('');
const editDisplayName = ref('');
const editingUser = ref(false);

// Create user form state
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

const openCreateModal = () => {
  showCreateModal.value = true;
};

const resetCreateForm = () => {
  newEmail.value = '';
  newUsername.value = '';
  newPassword.value = '';
  newIsAdmin.value = false;
};

const closeCreateModal = () => {
  showCreateModal.value = false;
  resetCreateForm();
};

const openEditModal = (user) => {
  editUser.value = user;
  editEmail.value = user.email || '';
  editUsername.value = user.username || '';
  editDisplayName.value = user.displayName || '';
  showEditModal.value = true;
};

const closeEditModal = () => {
  showEditModal.value = false;
  editUser.value = null;
};

const grantAdmin = async (u) => {
  const nextRoles = Array.from(new Set([...(u.roles || []), 'admin']));
  try {
    const res = await updateUserRoles(u.id, nextRoles);
    const updated = res?.user;
    if (updated) {
      users.value = users.value.map((it) => (it.id === u.id ? updated : it));
    }
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
      closeCreateModal();
    }
  } catch (e) {
    alert(e?.message || t('settings.users.failedCreate'));
  } finally {
    creating.value = false;
  }
};

const handleEditSave = async () => {
  if (!editUser.value) return;
  if (!editEmail.value.trim()) {
    alert(t('auth.errors.emailRequired'));
    return;
  }
  editingUser.value = true;
  try {
    const res = await updateUser(editUser.value.id, {
      email: editEmail.value.trim(),
      username: editUsername.value.trim(),
      displayName: editDisplayName.value.trim()
    });
    const updated = res?.user;
    if (updated) {
      users.value = users.value.map((it) => (it.id === updated.id ? updated : it));
    }
    closeEditModal();
  } catch (e) {
    alert(e?.message || t('settings.users.failedUpdate'));
  } finally {
    editingUser.value = false;
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
        <button
          type="button"
          class="rounded-md bg-blue-500 px-3 py-1 text-white hover:bg-blue-400"
          @click="openCreateModal"
        >
          {{ t('settings.users.createUser') }}
        </button>
      </div>
    </div>
    <p v-if="errorMsg" class="text-sm text-red-500">{{ errorMsg }}</p>

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
            <td class="px-3 py-2 flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded px-3 py-1 text-sm border border-white/20 hover:bg-white/10"
                @click="openEditModal(u)"
              >
                {{ t('settings.users.editUser') }}
              </button>
              <button
                v-if="!(u.roles || []).includes('admin')"
                type="button"
                class="rounded px-3 py-1 text-sm border border-white/20 hover:bg-white/10"
                @click="grantAdmin(u)"
              >
                {{ t('settings.users.makeAdmin') }}
              </button>

              <button
                type="button"
                class="rounded px-3 py-1 text-sm border border-white/20 hover:bg-white/10"
                @click="handleResetPassword(u)"
              >
                {{ t('settings.users.resetPassword') }}
              </button>

              <button
                v-if="u.id !== auth.currentUser?.id"
                type="button"
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

    <div
      v-if="showCreateModal"
      class="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      role="dialog"
      aria-modal="true"
    >
      <div class="fixed inset-0 bg-black/50" @click="closeCreateModal"></div>
      <div class="relative z-10 w-full max-w-3xl overflow-hidden rounded-lg border border-white/10 bg-white/90 p-6 shadow-xl dark:border-white/10 dark:bg-zinc-900/90">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">{{ t('settings.users.createUser') }}</h3>
          <button
            type="button"
            class="text-neutral-500 hover:text-neutral-300"
            :aria-label="t('common.dismiss')"
            @click="closeCreateModal"
          >
            &times;
          </button>
        </div>
        <form class="mt-4 space-y-4" @submit.prevent="handleCreate">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <label class="block text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{{ t('settings.users.email') }} *</label>
              <input
                v-model.trim="newEmail"
                type="email"
                :placeholder="t('settings.users.emailPlaceholder')"
                class="w-full rounded-md border border-white/10 bg-transparent px-2 py-1"
              />
            </div>
            <div>
              <label class="block text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{{ t('settings.users.username') }}</label>
              <input
                v-model.trim="newUsername"
                :placeholder="t('settings.users.usernameOptional')"
                class="w-full rounded-md border border-white/10 bg-transparent px-2 py-1"
              />
            </div>
            <div>
              <label class="block text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{{ t('settings.users.password') }} *</label>
              <input
                v-model="newPassword"
                type="password"
                placeholder="••••••"
                class="w-full rounded-md border border-white/10 bg-transparent px-2 py-1"
              />
            </div>
            <div class="flex items-end">
              <label class="inline-flex items-center gap-2">
                <input type="checkbox" v-model="newIsAdmin" />
                <span>{{ t('settings.users.grantAdmin') }}</span>
              </label>
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="rounded-md border border-white/10 px-3 py-1 text-sm text-white hover:bg-white/5"
              @click="closeCreateModal"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              type="submit"
              :disabled="creating"
              class="rounded-md bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-500 disabled:opacity-60"
            >
              {{ creating ? t('settings.users.creating') : t('common.create') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div
      v-if="showEditModal"
      class="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      role="dialog"
      aria-modal="true"
    >
      <div class="fixed inset-0 bg-black/50" @click="closeEditModal"></div>
      <div class="relative z-10 w-full max-w-2xl overflow-hidden rounded-lg border border-white/10 bg-white/90 p-6 shadow-xl dark:border-white/10 dark:bg-zinc-900/90">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">{{ t('settings.users.editUser') }}</h3>
          <button
            type="button"
            class="text-neutral-500 hover:text-neutral-300"
            :aria-label="t('common.dismiss')"
            @click="closeEditModal"
          >
            &times;
          </button>
        </div>
        <form class="mt-4 space-y-4" @submit.prevent="handleEditSave">
          <div>
            <label class="block text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{{ t('settings.users.email') }} *</label>
            <input
              v-model.trim="editEmail"
              type="email"
              :placeholder="t('settings.users.emailPlaceholder')"
              class="w-full rounded-md border border-white/10 bg-transparent px-2 py-1"
            />
          </div>
          <div>
            <label class="block text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{{ t('settings.users.username') }}</label>
            <input
              v-model.trim="editUsername"
              type="text"
              :placeholder="t('settings.users.usernameOptional')"
              class="w-full rounded-md border border-white/10 bg-transparent px-2 py-1"
            />
          </div>
          <div>
            <label class="block text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{{ t('settings.users.displayName') }}</label>
            <input
              v-model.trim="editDisplayName"
              type="text"
              class="w-full rounded-md border border-white/10 bg-transparent px-2 py-1"
            />
          </div>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="rounded-md border border-white/10 px-3 py-1 text-sm text-white hover:bg-white/5"
              @click="closeEditModal"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              type="submit"
              :disabled="editingUser"
              class="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {{ editingUser ? t('settings.users.updating') : t('common.save') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

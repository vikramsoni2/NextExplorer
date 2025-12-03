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
import UserList from './components/UserList.vue';
import UserDetail from './components/UserDetail.vue';

const auth = useAuthStore();
const { t } = useI18n();

const users = ref([]);
const loading = ref(false);
const errorMsg = ref('');
const selectedUser = ref(null);
const saving = ref(false);

// Create User Modal State
const showCreateModal = ref(false);
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
    
    // If we have a selected user, update their data from the fresh list
    if (selectedUser.value) {
      const freshUser = users.value.find(u => u.id === selectedUser.value.id);
      if (freshUser) {
        selectedUser.value = freshUser;
      } else {
        selectedUser.value = null; // User was deleted?
      }
    }
  } catch (e) {
    errorMsg.value = e?.message || t('errors.loadUsers');
  } finally {
    loading.value = false;
  }
};

const handleSelectUser = (user) => {
  selectedUser.value = user;
};

const handleBack = () => {
  selectedUser.value = null;
};

// User Actions
const handleUpdateUser = async (userData) => {
  saving.value = true;
  try {
    const res = await updateUser(userData.id, {
      email: userData.email,
      username: userData.username,
      displayName: userData.displayName
    });
    
    if (res?.user) {
      // Update local list
      users.value = users.value.map(u => u.id === userData.id ? { ...u, ...res.user } : u);
      selectedUser.value = { ...selectedUser.value, ...res.user };
    }
  } catch (e) {
    alert(e?.message || t('errors.updateUser'));
  } finally {
    saving.value = false;
  }
};

const handleMakeAdmin = async (u) => {
  const nextRoles = Array.from(new Set([...(u.roles || []), 'admin']));
  try {
    const res = await updateUserRoles(u.id, nextRoles);
    const updated = res?.user;
    if (updated) {
      users.value = users.value.map((it) => (it.id === u.id ? updated : it));
      if (selectedUser.value?.id === u.id) {
        selectedUser.value = updated;
      }
    }
  } catch (e) {
    alert(e?.message || t('errors.updateRoles'));
  }
};

const handleRevokeAdmin = async (u) => {
  const nextRoles = (u.roles || []).filter(r => r !== 'admin');
  try {
    const res = await updateUserRoles(u.id, nextRoles);
    const updated = res?.user;
    if (updated) {
      users.value = users.value.map((it) => (it.id === u.id ? updated : it));
      if (selectedUser.value?.id === u.id) {
        selectedUser.value = updated;
      }
    }
  } catch (e) {
    alert(e?.message || t('errors.updateRoles'));
  }
};

const handleResetPassword = async (u) => {
  const pwd = window.prompt(t('settings.users.promptNewPassword', { user: u.username }));
  if (pwd == null) return; // cancelled
  if (pwd.length < 6) {
    alert(t('errors.passwordMin'));
    return;
  }
  try {
    await adminSetUserPassword(u.id, pwd);
    alert(t('status.passwordUpdated'));
    // Ideally we should refresh the user to update "hasLocalAuth" status if we had that info in the API response
    // But for now, we assume it worked.
    loadUsers(); 
  } catch (e) {
    alert(e?.message || t('errors.resetPassword'));
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
    selectedUser.value = null;
  } catch (e) {
    alert(e?.message || t('errors.removeUser'));
  }
};

// Create User Logic
const openCreateModal = () => {
  newEmail.value = '';
  newUsername.value = '';
  newPassword.value = '';
  newIsAdmin.value = false;
  showCreateModal.value = true;
};

const closeCreateModal = () => {
  showCreateModal.value = false;
};

const handleCreate = async () => {
  if (!newEmail.value.trim()) {
    alert(t('errors.emailRequired'));
    return;
  }
  if (newPassword.value.length < 6) {
    alert(t('errors.passwordMin'));
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
      // Optionally select the new user?
      // selectedUser.value = res.user;
    }
  } catch (e) {
    alert(e?.message || t('errors.createUser'));
  } finally {
    creating.value = false;
  }
};

onMounted(() => { loadUsers(); });
</script>

<template>
  <div class="h-full">
    <div v-if="errorMsg" class="mb-4 p-4 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md">
      {{ errorMsg }}
    </div>

    <!-- Detail View -->
    <UserDetail
      v-if="selectedUser"
      :user="selectedUser"
      :saving="saving"
      @back="handleBack"
      @update="handleUpdateUser"
      @make-admin="handleMakeAdmin"
      @revoke-admin="handleRevokeAdmin"
      @reset-password="handleResetPassword"
      @delete="handleDeleteUser"
    />

    <!-- List View -->
    <UserList
      v-else
      :users="users"
      :loading="loading"
      @select="handleSelectUser"
      @create="openCreateModal"
    />

    <!-- Create Modal -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      role="dialog"
      aria-modal="true"
    >
      <div class="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity" @click="closeCreateModal"></div>
      <div class="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 transform transition-all">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{{ t('settings.users.createUser') }}</h3>
          <button
            type="button"
            class="text-zinc-400 hover:text-zinc-500 dark:hover:text-zinc-300"
            @click="closeCreateModal"
          >
            <span class="sr-only">{{ t('common.dismiss') }}</span>
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form class="space-y-4" @submit.prevent="handleCreate">
          <div>
            <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{{ t('common.email') }} <span class="text-red-500">*</span></label>
            <input
              v-model.trim="newEmail"
              type="email"
              required
              :placeholder="t('placeholders.email')"
              class="block w-full rounded-md border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs focus:border-zinc-500 focus:ring-zinc-500 sm:text-sm p-2 border"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{{ t('common.username') }}</label>
            <input
              v-model.trim="newUsername"
              type="text"
              :placeholder="t('placeholders.username')"
              class="block w-full rounded-md border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs focus:border-zinc-500 focus:ring-zinc-500 sm:text-sm p-2 border"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{{ t('common.password') }} <span class="text-red-500">*</span></label>
            <input
              v-model="newPassword"
              type="password"
              required
              placeholder="••••••"
              class="block w-full rounded-md border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs focus:border-zinc-500 focus:ring-zinc-500 sm:text-sm p-2 border"
            />
            <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{{ t('errors.passwordMin') }}</p>
          </div>
          
          <div class="flex items-start pt-2">
            <div class="flex h-5 items-center">
              <input
                id="is-admin"
                v-model="newIsAdmin"
                type="checkbox"
                class="h-4 w-4 rounded-sm border-zinc-300 text-zinc-600 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <div class="ml-3 text-sm">
              <label for="is-admin" class="font-medium text-zinc-700 dark:text-zinc-300">{{ t('settings.users.grantAdmin') }}</label>
              <p class="text-zinc-500 dark:text-zinc-400">Grants full access to all settings and users.</p>
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              class="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-xs hover:bg-zinc-50 focus:outline-hidden focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              @click="closeCreateModal"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              type="submit"
              :disabled="creating"
              class="inline-flex justify-center rounded-md border border-transparent bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50"
            >
              {{ creating ? t('common.creating') : t('common.create') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

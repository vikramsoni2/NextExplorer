<script setup>
import { onMounted, ref } from 'vue';
import { fetchUsers, updateUserRoles } from '@/api';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const users = ref([]);
const loading = ref(false);
const errorMsg = ref('');

const loadUsers = async () => {
  loading.value = true;
  errorMsg.value = '';
  try {
    const res = await fetchUsers();
    users.value = Array.isArray(res?.users) ? res.users : [];
  } catch (e) {
    errorMsg.value = e?.message || 'Failed to load users';
  } finally {
    loading.value = false;
  }
};

const toggleAdmin = async (u) => {
  const hasAdmin = Array.isArray(u.roles) && u.roles.includes('admin');
  const nextRoles = hasAdmin ? (u.roles || []).filter((r) => r !== 'admin') : [...(u.roles || []), 'admin'];
  try {
    const res = await updateUserRoles(u.id, nextRoles);
    const updated = res?.user;
    users.value = users.value.map((it) => (it.id === u.id ? updated : it));
  } catch (e) {
    alert(e?.message || 'Failed to update roles');
  }
};

onMounted(() => { loadUsers(); });
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-3">
      <h2 class="text-lg font-semibold">User Management</h2>
      <span v-if="loading" class="text-sm opacity-75">Loading…</span>
    </div>
    <p v-if="errorMsg" class="text-sm text-red-500">{{ errorMsg }}</p>

    <div class="overflow-x-auto rounded border border-white/10">
      <table class="w-full text-left text-sm">
        <thead class="bg-white/5">
          <tr>
            <th class="px-3 py-2">Username</th>
            <th class="px-3 py-2">Provider</th>
            <th class="px-3 py-2">Display Name</th>
            <th class="px-3 py-2">Email</th>
            <th class="px-3 py-2">Roles</th>
            <th class="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id" class="border-t border-white/5">
            <td class="px-3 py-2">{{ u.username }}</td>
            <td class="px-3 py-2">{{ u.provider }}</td>
            <td class="px-3 py-2">{{ u.displayName || '—' }}</td>
            <td class="px-3 py-2">{{ u.email || '—' }}</td>
            <td class="px-3 py-2">{{ (u.roles || []).join(', ') || '—' }}</td>
            <td class="px-3 py-2">
              <button
                class="rounded px-3 py-1 text-sm border border-white/20 hover:bg-white/10"
                :disabled="auth.currentUser?.id === u.id && (u.roles || []).includes('admin') === false && (u.roles || []).includes('admin')"
                @click="toggleAdmin(u)"
              >
                {{ (u.roles || []).includes('admin') ? 'Remove admin' : 'Make admin' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>


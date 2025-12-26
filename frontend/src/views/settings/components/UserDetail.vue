<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ArrowLeftIcon,
  TrashIcon,
  KeyIcon,
  ShieldCheckIcon,
  CloudIcon,
  ServerIcon,
  PlusIcon,
  PencilIcon,
  FolderIcon,
} from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/auth';
import { useFeaturesStore } from '@/stores/features';
import { fetchUserVolumes, removeUserVolume } from '@/api';
import VolumeAssignModal from './VolumeAssignModal.vue';

const props = defineProps({
  user: {
    type: Object,
    required: true,
  },
  saving: Boolean,
});

const emit = defineEmits([
  'back',
  'update',
  'reset-password',
  'delete',
  'make-admin',
  'revoke-admin',
]);
const { t } = useI18n();
const authStore = useAuthStore();
const featuresStore = useFeaturesStore();

const activeTab = ref('profile');

const formData = ref({
  displayName: '',
  username: '',
  email: '',
});

const hasLocalAuth = computed(() => {
  return (props.user.authMethods || []).some(
    (a) => a.method === 'local_password',
  );
});

const oidcProfiles = computed(() => {
  return (props.user.authMethods || []).filter((a) => a.method === 'oidc');
});

const isCurrentUser = computed(() => {
  return props.user.id === authStore.currentUser?.id;
});

const isAdmin = computed(() => {
  return (props.user.roles || []).includes('admin');
});

const userVolumesEnabled = computed(() => featuresStore.userVolumesEnabled);

// Volumes state
const volumes = ref([]);
const volumesLoading = ref(false);
const showVolumeModal = ref(false);
const editingVolume = ref(null);

const loadVolumes = async () => {
  if (!userVolumesEnabled.value) return;

  volumesLoading.value = true;
  try {
    const res = await fetchUserVolumes(props.user.id);
    volumes.value = Array.isArray(res?.volumes) ? res.volumes : [];
  } catch (e) {
    console.error('Failed to load user volumes:', e);
    volumes.value = [];
  } finally {
    volumesLoading.value = false;
  }
};

const handleAddVolume = () => {
  editingVolume.value = null;
  showVolumeModal.value = true;
};

const handleEditVolume = (volume) => {
  editingVolume.value = volume;
  showVolumeModal.value = true;
};

const handleVolumeModalClose = () => {
  showVolumeModal.value = false;
  editingVolume.value = null;
};

const handleVolumeSaved = () => {
  showVolumeModal.value = false;
  editingVolume.value = null;
  loadVolumes();
};

const handleRemoveVolume = async (volume) => {
  const ok = window.confirm(
    t('settings.users.confirmRemoveVolume', { label: volume.label }),
  );
  if (!ok) return;

  try {
    await removeUserVolume(props.user.id, volume.id);
    volumes.value = volumes.value.filter((v) => v.id !== volume.id);
  } catch (e) {
    alert(e?.message || t('errors.removeVolume'));
  }
};

// Init form data when user changes
watch(
  () => props.user,
  (u) => {
    if (u) {
      formData.value = {
        displayName: u.displayName || '',
        username: u.username || '',
        email: u.email || '',
      };
      // Load volumes when user changes
      loadVolumes();
    }
  },
  { immediate: true },
);

onMounted(() => {
  featuresStore.ensureLoaded();
});

const handleSaveProfile = () => {
  emit('update', {
    id: props.user.id,
    ...formData.value,
  });
};

const getInitials = (name) => {
  return (name || 'U').substring(0, 2).toUpperCase();
};
</script>

<template>
  <div class="flex flex-col h-full animate-fade-in">
    <!-- Header -->
    <div class="flex items-center gap-4 mb-6">
      <button
        @click="$emit('back')"
        class="p-2 rounded-md text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
        :title="t('common.back')"
      >
        <ArrowLeftIcon class="w-5 h-5" />
      </button>
      <div class="flex items-center gap-4">
        <div
          class="h-12 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 font-medium text-lg"
        >
          {{ getInitials(user.displayName || user.username || user.email) }}
        </div>
        <div>
          <h2 class="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {{ user.displayName || user.username }}
          </h2>
          <div
            class="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400"
          >
            <span>{{ user.email }}</span>
            <span
              v-if="isAdmin"
              class="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
            >
              Admin
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="border-b border-zinc-200 dark:border-zinc-800 mb-6">
      <nav class="-mb-px flex space-x-8" aria-label="Tabs">
        <button
          @click="activeTab = 'profile'"
          :class="[
            activeTab === 'profile'
              ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100'
              : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-300',
            'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
          ]"
        >
          Profile
        </button>
        <button
          @click="activeTab = 'security'"
          :class="[
            activeTab === 'security'
              ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100'
              : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-300',
            'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
          ]"
        >
          Security
        </button>
        <button
          v-if="userVolumesEnabled"
          @click="activeTab = 'volumes'"
          :class="[
            activeTab === 'volumes'
              ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100'
              : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-300',
            'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
          ]"
        >
          {{ t('settings.users.volumes') }}
        </button>
      </nav>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto pb-10">
      <!-- Profile Tab -->
      <div v-if="activeTab === 'profile'" class="space-y-8 max-w-3xl">
        <div
          class="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6"
        >
          <h3 class="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
            General Information
          </h3>
          <form @submit.prevent="handleSaveProfile" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                  >Display Name</label
                >
                <input
                  v-model="formData.displayName"
                  type="text"
                  class="block w-full rounded-md border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs focus:border-zinc-500 focus:ring-zinc-500 sm:text-sm p-2 border"
                />
              </div>
              <div>
                <label
                  class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                  >Username</label
                >
                <input
                  v-model="formData.username"
                  type="text"
                  class="block w-full rounded-md border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs focus:border-zinc-500 focus:ring-zinc-500 sm:text-sm p-2 border"
                />
              </div>
            </div>
            <div>
              <label
                class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                >Email Address</label
              >
              <input
                v-model="formData.email"
                type="email"
                class="block w-full rounded-md border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs focus:border-zinc-500 focus:ring-zinc-500 sm:text-sm p-2 border"
              />
            </div>
            <div class="pt-2 flex justify-end">
              <button
                type="submit"
                :disabled="saving"
                class="inline-flex justify-center rounded-md border border-transparent bg-zinc-900 py-2 px-4 text-sm font-medium text-white shadow-xs hover:bg-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50"
              >
                {{ saving ? t('common.saving') : t('common.save') }}
              </button>
            </div>
          </form>
        </div>

        <!-- Roles -->
        <div
          class="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6"
        >
          <h3 class="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
            Roles & Permissions
          </h3>
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <ShieldCheckIcon class="w-5 h-5 text-zinc-500" />
                <span class="font-medium text-zinc-900 dark:text-zinc-100"
                  >Administrator</span
                >
              </div>
              <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1 ml-7">
                Can access all settings and manage users.
              </p>
            </div>
            <button
              v-if="!isAdmin"
              @click="$emit('make-admin', user)"
              class="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium"
            >
              Grant Admin
            </button>
            <button
              v-else
              @click="$emit('revoke-admin', user)"
              :disabled="isCurrentUser"
              class="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              :title="isCurrentUser ? t('settings.users.cannotDeleteSelf') : ''"
            >
              Revoke Admin
            </button>
          </div>
        </div>

        <!-- Danger Zone -->
        <div
          v-if="!isCurrentUser"
          class="bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-900/30 p-6"
        >
          <h3 class="text-lg font-medium text-red-800 dark:text-red-300 mb-4">
            Danger Zone
          </h3>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-red-700 dark:text-red-400">
                Permanently remove this user and all their data. This action
                cannot be undone.
              </p>
            </div>
            <button
              @click="$emit('delete', user)"
              class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40"
            >
              <TrashIcon class="w-4 h-4 mr-2" />
              Delete User
            </button>
          </div>
        </div>
      </div>

      <!-- Security Tab -->
      <div v-if="activeTab === 'security'" class="space-y-8 max-w-3xl">
        <!-- Password -->
        <div
          class="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6"
        >
          <h3 class="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
            Password
          </h3>
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <KeyIcon class="w-5 h-5 text-zinc-500" />
                <span class="font-medium text-zinc-900 dark:text-zinc-100"
                  >Local Password</span
                >
              </div>
              <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1 ml-7">
                {{
                  hasLocalAuth
                    ? 'User has a local password set.'
                    : 'User does not have a local password set.'
                }}
              </p>
            </div>
            <button
              @click="$emit('reset-password', user)"
              class="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium"
            >
              {{ hasLocalAuth ? 'Reset Password' : 'Set Password' }}
            </button>
          </div>
        </div>

        <!-- OIDC Profiles -->
        <div
          class="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6"
        >
          <h3 class="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
            Single Sign-On (OIDC)
          </h3>

          <div v-if="oidcProfiles.length > 0" class="space-y-4">
            <div
              v-for="(profile, idx) in oidcProfiles"
              :key="idx"
              class="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
            >
              <div class="flex items-center gap-3">
                <div class="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                  <CloudIcon class="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div>
                  <p
                    class="text-sm font-medium text-zinc-900 dark:text-zinc-100"
                  >
                    {{ profile.provider || 'OIDC Provider' }}
                  </p>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400">
                    Linked Profile
                  </p>
                </div>
              </div>
              <!-- Placeholder for unlink action if needed in future -->
              <span
                class="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full"
                >Active</span
              >
            </div>
          </div>

          <div
            v-else
            class="text-center py-6 text-zinc-500 dark:text-zinc-400 text-sm"
          >
            <CloudIcon class="w-10 h-10 mx-auto mb-2 opacity-20" />
            No OIDC profiles linked to this account.
          </div>
        </div>
      </div>

      <!-- Volumes Tab -->
      <div v-if="activeTab === 'volumes'" class="space-y-8 max-w-3xl">
        <div
          class="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6"
        >
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              {{ t('settings.users.assignedVolumes') }}
            </h3>
            <button
              @click="handleAddVolume"
              class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-zinc-900 hover:bg-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <PlusIcon class="w-4 h-4 mr-2" />
              {{ t('settings.users.addVolume') }}
            </button>
          </div>

          <!-- Loading state -->
          <div v-if="volumesLoading" class="py-8 text-center">
            <div
              class="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100 mx-auto"
            ></div>
            <p class="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {{ t('common.loading') }}
            </p>
          </div>

          <!-- Empty state -->
          <div
            v-else-if="volumes.length === 0"
            class="text-center py-8 text-zinc-500 dark:text-zinc-400"
          >
            <ServerIcon class="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p class="text-sm">{{ t('settings.users.noVolumes') }}</p>
            <p class="text-xs mt-1">{{ t('settings.users.noVolumesHint') }}</p>
          </div>

          <!-- Volumes list -->
          <div v-else class="space-y-3">
            <div
              v-for="volume in volumes"
              :key="volume.id"
              class="flex items-center justify-between p-4 rounded-lg border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div class="flex items-center gap-4">
                <div class="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                  <FolderIcon
                    class="w-6 h-6 text-zinc-600 dark:text-zinc-400"
                  />
                </div>
                <div>
                  <p class="font-medium text-zinc-900 dark:text-zinc-100">
                    {{ volume.label }}
                  </p>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    {{ volume.path }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span
                  :class="[
                    'text-xs px-2 py-1 rounded-full',
                    volume.accessMode === 'readonly'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                      : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
                  ]"
                >
                  {{
                    volume.accessMode === 'readonly'
                      ? t('common.readonly')
                      : t('common.readwrite')
                  }}
                </span>
                <button
                  @click="handleEditVolume(volume)"
                  class="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  :title="t('common.edit')"
                >
                  <PencilIcon class="w-4 h-4" />
                </button>
                <button
                  @click="handleRemoveVolume(volume)"
                  class="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  :title="t('common.remove')"
                >
                  <TrashIcon class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Info box -->
        <div
          class="bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-900/30 p-4"
        >
          <p class="text-sm text-blue-700 dark:text-blue-400">
            {{ t('settings.users.volumesInfo') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Volume Assign Modal -->
    <VolumeAssignModal
      v-if="showVolumeModal"
      :user-id="user.id"
      :editing-volume="editingVolume"
      @close="handleVolumeModalClose"
      @saved="handleVolumeSaved"
    />
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

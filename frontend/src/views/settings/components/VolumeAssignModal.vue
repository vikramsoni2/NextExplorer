<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  XMarkIcon,
  FolderIcon,
  ChevronRightIcon,
  ArrowUpIcon,
  ChevronDownIcon,
} from '@heroicons/vue/24/outline';
import { browseAdminDirectories, addUserVolume, updateUserVolume } from '@/api';

const props = defineProps({
  userId: {
    type: String,
    required: true,
  },
  editingVolume: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['close', 'saved']);
const { t } = useI18n();

const isEditing = computed(() => !!props.editingVolume);

// Form state
const label = ref('');
const selectedPath = ref('');
const accessMode = ref('readwrite');
const saving = ref(false);
const error = ref('');

// Directory browser state
const currentPath = ref('');
const parentPath = ref(null);
const directories = ref([]);
const browsing = ref(false);
const browseError = ref('');

// Initialize form when editing
watch(
  () => props.editingVolume,
  (vol) => {
    if (vol) {
      label.value = vol.label || '';
      selectedPath.value = vol.path || '';
      accessMode.value = vol.accessMode || 'readwrite';
      // When editing, start browsing from the parent of the current path
      const pathParts = vol.path.split('/');
      pathParts.pop();
      currentPath.value = pathParts.join('/') || '/';
    }
  },
  { immediate: true },
);

const loadDirectories = async (path = '') => {
  browsing.value = true;
  browseError.value = '';

  try {
    const res = await browseAdminDirectories(path);
    currentPath.value = res.current || path;
    parentPath.value = res.parent || null;
    directories.value = Array.isArray(res.directories) ? res.directories : [];
  } catch (e) {
    browseError.value = e?.message || t('errors.browseDirectories');
    directories.value = [];
  } finally {
    browsing.value = false;
  }
};

const navigateToDirectory = (dir) => {
  loadDirectories(dir.path);
};

const navigateUp = () => {
  if (parentPath.value) {
    loadDirectories(parentPath.value);
  }
};

const selectDirectory = (dir) => {
  selectedPath.value = dir.path;
  // Auto-fill label with directory name if label is empty
  if (!label.value.trim()) {
    label.value = dir.name;
  }
};

const selectCurrentDirectory = () => {
  selectedPath.value = currentPath.value;
  // Auto-fill label with current directory name if label is empty
  if (!label.value.trim()) {
    const parts = currentPath.value.split('/').filter(Boolean);
    label.value = parts[parts.length - 1] || 'Volume';
  }
};

const handleSubmit = async () => {
  error.value = '';

  if (!label.value.trim()) {
    error.value = t('errors.labelRequired');
    return;
  }

  if (!selectedPath.value.trim()) {
    error.value = t('errors.pathRequired');
    return;
  }

  saving.value = true;

  try {
    if (isEditing.value) {
      await updateUserVolume(props.userId, props.editingVolume.id, {
        label: label.value.trim(),
        accessMode: accessMode.value,
      });
    } else {
      await addUserVolume(props.userId, {
        label: label.value.trim(),
        path: selectedPath.value,
        accessMode: accessMode.value,
      });
    }
    emit('saved');
  } catch (e) {
    error.value = e?.message || t('errors.saveVolume');
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  if (!isEditing.value) {
    loadDirectories();
  } else {
    // For editing, load the parent directory of the current volume path
    const pathParts = props.editingVolume.path.split('/');
    pathParts.pop();
    loadDirectories(pathParts.join('/') || '/');
  }
});
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
    role="dialog"
    aria-modal="true"
  >
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
      @click="emit('close')"
    ></div>

    <!-- Modal -->
    <div
      class="relative z-10 w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 transform transition-all"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800"
      >
        <h3 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {{
            isEditing
              ? t('settings.users.editVolume')
              : t('settings.users.addVolume')
          }}
        </h3>
        <button
          type="button"
          class="text-zinc-400 hover:text-zinc-500 dark:hover:text-zinc-300"
          @click="emit('close')"
        >
          <span class="sr-only">{{ t('common.dismiss') }}</span>
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>

      <!-- Content -->
      <div class="px-6 py-4 max-h-[70vh] overflow-y-auto">
        <!-- Error message -->
        <div
          v-if="error"
          class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm"
        >
          {{ error }}
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-5">
          <div
            class="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_12rem] gap-5 items-start"
          >
            <!-- Label -->
            <div>
              <label
                for="volume-label"
                class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                {{ t('settings.users.volumeLabel') }}
                <span class="text-red-500">*</span>
              </label>
              <input
                id="volume-label"
                v-model="label"
                type="text"
                :placeholder="t('placeholders.volumeLabel')"
                class="block w-full rounded-md border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs focus:border-zinc-500 focus:ring-zinc-500 sm:text-sm p-2 border"
              />
              <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {{ t('settings.users.volumeLabelHint') }}
              </p>
            </div>

            <!-- Access Mode -->
            <div>
              <label
                for="access-mode"
                class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                {{ t('settings.users.accessMode') }}
              </label>
              <div class="relative">
                <select
                  id="access-mode"
                  v-model="accessMode"
                  class="block w-full appearance-none rounded-md border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs focus:border-zinc-500 focus:ring-zinc-500 sm:text-sm p-2 pr-9 border"
                >
                  <option value="readwrite">{{ t('common.readwrite') }}</option>
                  <option value="readonly">{{ t('common.readonly') }}</option>
                </select>
                <ChevronDownIcon
                  class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                />
              </div>
            </div>
          </div>

          <!-- Directory Browser (only when adding) -->
          <div v-if="!isEditing">
            <label
              class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
            >
              {{ t('settings.users.selectDirectory') }}
              <span class="text-red-500">*</span>
            </label>

            <!-- Current path display -->
            <div class="mb-2 flex items-center gap-2">
              <span class="text-xs text-zinc-500 dark:text-zinc-400"
                >{{ t('settings.users.currentPath') }}:</span
              >
              <code
                class="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded font-mono"
                >{{ currentPath }}</code
              >
              <button
                v-if="currentPath !== selectedPath"
                type="button"
                @click="selectCurrentDirectory"
                class="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {{ t('settings.users.selectThis') }}
              </button>
            </div>

            <!-- Directory list -->
            <div
              class="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden"
            >
              <!-- Parent directory button -->
              <button
                v-if="parentPath"
                type="button"
                @click="navigateUp"
                class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-200 dark:border-zinc-700"
              >
                <ArrowUpIcon class="w-5 h-5 text-zinc-400" />
                <span class="text-sm text-zinc-600 dark:text-zinc-400">{{
                  t('settings.users.parentDirectory')
                }}</span>
              </button>

              <!-- Loading state -->
              <div v-if="browsing" class="p-8 text-center">
                <div
                  class="animate-spin rounded-full h-6 w-6 border-b-2 border-zinc-900 dark:border-zinc-100 mx-auto"
                ></div>
              </div>

              <!-- Browse error -->
              <div
                v-else-if="browseError"
                class="p-4 text-center text-sm text-red-600 dark:text-red-400"
              >
                {{ browseError }}
              </div>

              <!-- Empty state -->
              <div
                v-else-if="directories.length === 0"
                class="p-4 text-center text-sm text-zinc-500 dark:text-zinc-400"
              >
                {{ t('settings.users.noSubdirectories') }}
              </div>

              <!-- Directory list -->
              <div v-else class="max-h-64 overflow-y-auto">
                <div
                  v-for="dir in directories"
                  :key="dir.path"
                  :class="[
                    'flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0 cursor-pointer transition-colors',
                    selectedPath === dir.path
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800',
                  ]"
                  @click="selectDirectory(dir)"
                >
                  <div class="flex items-center gap-3">
                    <FolderIcon class="w-5 h-5 text-zinc-400" />
                    <span class="text-sm text-zinc-900 dark:text-zinc-100">{{
                      dir.name
                    }}</span>
                  </div>
                  <button
                    type="button"
                    @click.stop="navigateToDirectory(dir)"
                    class="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    :title="t('settings.users.enterDirectory')"
                  >
                    <ChevronRightIcon class="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Selected path display -->
            <div
              v-if="selectedPath"
              class="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg"
            >
              <p class="text-sm text-green-700 dark:text-green-400">
                <span class="font-medium"
                  >{{ t('settings.users.selectedPath') }}:</span
                >
                <code class="ml-2 font-mono">{{ selectedPath }}</code>
              </p>
            </div>
          </div>

          <!-- Path display when editing (read-only) -->
          <div v-else>
            <label
              class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              {{ t('settings.users.volumePath') }}
            </label>
            <div class="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              <code
                class="text-sm font-mono text-zinc-700 dark:text-zinc-300"
                >{{ selectedPath }}</code
              >
            </div>
            <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {{ t('settings.users.pathCannotChange') }}
            </p>
          </div>
        </form>
      </div>

      <!-- Footer -->
      <div
        class="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3"
      >
        <button
          type="button"
          class="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-xs hover:bg-zinc-50 focus:outline-hidden focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          @click="emit('close')"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          :disabled="saving || (!isEditing && !selectedPath)"
          class="inline-flex justify-center rounded-md border border-transparent bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="handleSubmit"
        >
          {{
            saving
              ? t('common.saving')
              : isEditing
                ? t('common.save')
                : t('settings.users.addVolume')
          }}
        </button>
      </div>
    </div>
  </div>
</template>

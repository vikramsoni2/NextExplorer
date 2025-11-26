<script setup>
import { computed, onMounted, onBeforeUnmount, watch, ref } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { useInfoPanelStore } from '@/stores/infoPanel';
import { formatBytes, formatDate } from '@/utils';
import { getKindLabel } from '@/utils/fileKinds';
import FileIcon from '@/icons/FileIcon.vue';
import MapPreview from '@/components/MapPreview.vue';
import PermissionsPanel from '@/components/PermissionsPanel.vue';
import { fetchMetadata, fetchPermissions, changePermissions, changeOwnership } from '@/api';
import { useI18n } from 'vue-i18n';

const store = useInfoPanelStore();

const isOpen = computed(() => store.isOpen);
const item = computed(() => store.item);
const relativePath = computed(() => store.relativePath);

const { t } = useI18n();
const title = computed(() => item.value?.name || t('info.details'));
const kindLabel = computed(() => (item.value ? getKindLabel(item.value) : ''));

const sizeLabel = computed(() => {
  const it = item.value;
  if (!it) return '';
  if (it.kind === 'directory') return '—';
  if (typeof it.size === 'number') return formatBytes(it.size);
  return '';
});

const modifiedLabel = computed(() => {
  const it = item.value;
  if (!it || !it.dateModified) return '';
  return formatDate(it.dateModified);
});

const locationLabel = computed(() => item.value?.path || '');

const loading = ref(false);
const details = ref(null);
const errorMsg = ref('');

const permissionsLoading = ref(false);
const permissions = ref(null);
const permissionsError = ref('');

const loadDetails = async () => {
  if (!isOpen.value || !relativePath.value) {
    details.value = null;
    return;
  }
  loading.value = true;
  errorMsg.value = '';
  try {
    details.value = await fetchMetadata(relativePath.value);
  } catch (e) {
    errorMsg.value = e?.message || t('info.failed');
  } finally {
    loading.value = false;
  }
};

const loadPermissions = async () => {
  if (!isOpen.value || !relativePath.value) {
    permissions.value = null;
    return;
  }
  permissionsLoading.value = true;
  permissionsError.value = '';
  try {
    permissions.value = await fetchPermissions(relativePath.value);
  } catch (e) {
    permissionsError.value = e?.message || 'Failed to load permissions';
  } finally {
    permissionsLoading.value = false;
  }
};

const handleChangePermissions = async ({ mode, recursive }) => {
  if (!relativePath.value) return;

  permissionsLoading.value = true;
  permissionsError.value = '';

  try {
    await changePermissions(relativePath.value, mode, recursive);
    // Reload permissions after successful change
    await loadPermissions();
  } catch (e) {
    permissionsError.value = e?.message || 'Failed to change permissions';
  } finally {
    permissionsLoading.value = false;
  }
};

const handleChangeOwner = async ({ owner, group }) => {
  if (!relativePath.value) return;

  permissionsLoading.value = true;
  permissionsError.value = '';

  try {
    await changeOwnership(relativePath.value, owner, group);
    // Reload permissions after successful change
    await loadPermissions();
  } catch (e) {
    permissionsError.value = e?.message || 'Failed to change ownership';
  } finally {
    permissionsLoading.value = false;
  }
};

const panelRef = ref(null);
const trapFocus = (e) => {
  if (!store.isOpen) return;
  const el = panelRef.value;
  if (!el) return;
  if (!el.contains(e.target)) {
    e.stopPropagation();
    el.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus?.();
  }
};

onMounted(() => {
  // Minimal focus trap to avoid scrolling issues when open
  window.addEventListener('focusin', trapFocus);
  const onKey = (e) => { if (e.key === 'Escape' && store.isOpen) { e.preventDefault(); close(); } };
  window.addEventListener('keydown', onKey);
  // store handler to remove later
  cleanup.value = () => { window.removeEventListener('keydown', onKey); };
});

watch(isOpen, (open) => {
  document.body.classList.toggle('overflow-hidden', open);
  if (open) {
    loadDetails();
    loadPermissions();
  }
});

watch(relativePath, () => {
  if (isOpen.value) {
    loadDetails();
    loadPermissions();
  }
});

const cleanup = ref(() => {});
const close = () => store.close();

onBeforeUnmount(() => {
  window.removeEventListener('focusin', trapFocus);
  cleanup.value?.();
});
</script>

<template>
  <teleport to="body">
    <!-- Backdrop -->
    <transition name="ip-fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-1450 bg-black/30" 
        @click="close"
      />
    </transition>

    <!-- Panel -->
    <div 
      class="fixed inset-y-0 right-0 z-1500 w-[380px] sm:w-[420px] transform transition-transform duration-200 ease-out"
      :class="isOpen ? 'translate-x-0' : 'translate-x-full'"
      :aria-label="t('info.aria')"
    >
      <aside ref="panelRef" class="flex h-full flex-col border-l bg-white/90 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/80">
        <header class="flex items-start gap-3 border-b px-5 py-4 dark:border-white/5">
          <div class="min-w-0">
            <p class="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{{ t('info.details') }}</p>
            <h2 class="truncate text-lg font-semibold text-neutral-900 dark:text-white">{{ title }}</h2>
          </div>
          <button
            type="button"
            class="ml-auto rounded-md p-2 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-zinc-800 dark:hover:text-neutral-200"
            @click="close"
          >
            <XMarkIcon class="h-6 w-6" />
          </button>
        </header>

        <div class="flex-1 overflow-y-auto px-5 py-4">
          <!-- Preview / icon -->
          <div class="mb-4">
            <div class="rounded-xl border bg-neutral-50 p-3 dark:border-white/10 dark:bg-zinc-800/60">
              <div class="h-48 w-full overflow-hidden rounded-lg bg-neutral-100 dark:bg-zinc-800">
                <FileIcon v-if="item" :item="item" class="h-full w-full" />
              </div>
            </div>
          </div>

          <!-- Details list -->
          <div class="space-y-4">
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{{ t('info.fileName') }}</p>
              <p class="truncate text-neutral-900 dark:text-neutral-100">{{ item?.name }}</p>
            </div>

            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{{ t('info.type') }}</p>
              <p class="text-neutral-900 dark:text-neutral-100">{{ kindLabel }}</p>
            </div>

            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{{ t('info.size') }}</p>
              <p class="text-neutral-900 dark:text-neutral-100">{{ sizeLabel }}</p>
            </div>

            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{{ t('info.modified') }}</p>
              <p class="text-neutral-900 dark:text-neutral-100">{{ modifiedLabel }}</p>
            </div>

            <div v-if="locationLabel">
              <p class="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{{ t('info.location') }}</p>
              <p class="break-all text-neutral-900 dark:text-neutral-100">{{ locationLabel }}</p>
            </div>

            <!-- Folder specific metadata -->
            <div v-if="details?.directory" class="pt-2 border-t border-neutral-200 dark:border-white/5">
              <p class="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">{{ t('info.folder') }}</p>
              <p class="text-neutral-900 dark:text-neutral-100">{{ t('info.folderSize', { size: formatBytes(details.directory.totalSize || 0) }) }}</p>
              <p class="text-neutral-900 dark:text-neutral-100">{{ t('info.items', { files: details.directory.fileCount || 0, folders: details.directory.dirCount || 0 }) }}</p>
            </div>

            <!-- Image specific metadata -->
            <div v-if="details?.image" class="pt-2 border-t border-neutral-200 dark:border-white/5 space-y-2">
              <p class="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{{ t('info.image') }}</p>
              <p v-if="details.image.width && details.image.height" class="text-neutral-900 dark:text-neutral-100">{{ t('info.dimensions', { w: details.image.width, h: details.image.height }) }}</p>
              <p v-if="details.image.dateTaken" class="text-neutral-900 dark:text-neutral-100">{{ t('info.dateTaken', { date: formatDate(details.image.dateTaken) }) }}</p>
              <p v-if="details.image.cameraMake || details.image.cameraModel" class="text-neutral-900 dark:text-neutral-100">{{ t('info.camera', { makeModel: [details.image.cameraMake, details.image.cameraModel].filter(Boolean).join(' ') }) }}</p>
              <p v-if="details.image.lensModel" class="text-neutral-900 dark:text-neutral-100">{{ t('info.lens', { lens: details.image.lensModel }) }}</p>

              <!-- Map preview matching theme -->
              <div v-if="details.image.gps && details.image.gps.lat && details.image.gps.lon" class="mt-2">
                <MapPreview :lat="details.image.gps.lat" :lon="details.image.gps.lon" :height="200" />
              </div>
            </div>

            <!-- Video specific metadata -->
            <div v-if="details?.video" class="pt-2 border-t border-neutral-200 dark:border-white/5 space-y-1">
              <p class="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{{ t('info.video') }}</p>
              <p v-if="details.video.width && details.video.height" class="text-neutral-900 dark:text-neutral-100">{{ t('info.dimensions', { w: details.video.width, h: details.video.height }) }}</p>
              <p v-if="Number.isFinite(details.video.duration)" class="text-neutral-900 dark:text-neutral-100">{{ t('info.duration', { seconds: Math.round(details.video.duration) }) }}</p>
            </div>

            <!-- Loading / error states -->
            <div v-if="loading" class="text-sm text-neutral-500 dark:text-neutral-400">{{ t('info.loading') }}</div>
            <div v-else-if="errorMsg" class="text-sm text-red-600 dark:text-red-400">{{ errorMsg }}</div>

            <!-- Permissions Panel -->
            <PermissionsPanel
              :permissions="permissions"
              :is-directory="item?.kind === 'directory'"
              :loading="permissionsLoading"
              @change-permissions="handleChangePermissions"
              @change-owner="handleChangeOwner"
            />
            <div v-if="permissionsError" class="text-sm text-red-600 dark:text-red-400 mt-2">{{ permissionsError }}</div>
          </div>
        </div>
      </aside>
    </div>
  </teleport>
</template>

<style scoped>
.ip-fade-enter-active,
.ip-fade-leave-active { transition: opacity 0.15s ease; }
.ip-fade-enter-from,
.ip-fade-leave-to { opacity: 0; }
</style>

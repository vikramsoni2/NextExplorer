<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ShareIcon } from '@heroicons/vue/24/outline';
import { useFileStore } from '@/stores/fileStore';
import { normalizePath } from '@/api';
import ShareDialog from '@/components/ShareDialog.vue';

const { t } = useI18n();
const fileStore = useFileStore();

const isShareDialogOpen = ref(false);
const itemToShare = ref(null);

const isShareView = computed(() =>
  normalizePath(fileStore.getCurrentPath || '').startsWith('share/'),
);
const locationCanShare = computed(
  () => fileStore.currentPathData?.canShare ?? true,
);
const isShareAllowedHere = computed(
  () => locationCanShare.value && !isShareView.value,
);

const canShare = computed(() => {
  // Can share if exactly one item is selected
  return (
    isShareAllowedHere.value &&
    fileStore.selectedItems &&
    fileStore.selectedItems.length === 1
  );
});

const selectedItem = computed(() => {
  if (fileStore.selectedItems && fileStore.selectedItems.length === 1) {
    return fileStore.selectedItems[0];
  }
  return null;
});

function openShareDialog() {
  if (!canShare.value) return;
  itemToShare.value = selectedItem.value;
  isShareDialogOpen.value = true;
}

function handleShareCreated(share) {
  // Optionally handle the created share (e.g., show notification)
  console.log('Share created:', share);
}
</script>

<template>
  <div v-if="isShareAllowedHere" class="flex gap-1 items-center">
    <button
      type="button"
      @click="openShareDialog"
      :disabled="!canShare"
      class="p-[6px] rounded-md transition-colors hover:bg-[rgb(239,239,240)] active:bg-zinc-200 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
      :class="{ 'opacity-50 cursor-not-allowed': !canShare }"
      :title="
        canShare ? t('share.shareSelectedItem') : t('share.selectItemToShare')
      "
    >
      <ShareIcon class="w-6 h-6" />
    </button>

    <ShareDialog
      v-model="isShareDialogOpen"
      :item="itemToShare"
      @share-created="handleShareCreated"
    />
  </div>
</template>

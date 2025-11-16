<script setup>
import { useI18n } from 'vue-i18n';
import * as OutlineIcons from '@heroicons/vue/24/outline';
import * as SolidIcons from '@heroicons/vue/24/solid';
import ModalDialog from '@/components/ModalDialog.vue';
import { useFavoriteEditor } from '@/composables/useFavoriteEditor';

const { t } = useI18n();

const {
  isFavoriteEditorOpen,
  editorName,
  editorPath,
  editorIcon,
  isSaving,
  closeFavoriteEditor,
  saveFavoriteEditor,
} = useFavoriteEditor();

const ICON_VARIANTS = {
  outline: OutlineIcons,
  solid: SolidIcons,
};

const resolveIconComponent = (iconName) => {
  if (typeof iconName !== 'string') {
    return OutlineIcons.StarIcon;
  }

  const trimmed = iconName.trim();
  if (!trimmed) {
    return OutlineIcons.StarIcon;
  }

  if (trimmed.includes(':')) {
    const [variantRaw, iconRaw] = trimmed.split(':', 2);
    const variantKey = variantRaw.toLowerCase();
    const iconKey = iconRaw.trim();
    const registry = ICON_VARIANTS[variantKey];
    if (registry && registry[iconKey]) {
      return registry[iconKey];
    }
  }

  return OutlineIcons[trimmed] || SolidIcons[trimmed] || OutlineIcons.StarIcon;
};

const favoriteIconOptions = [
  'outline:StarIcon',
  'outline:FolderIcon',
  'outline:HomeIcon',
  'outline:HeartIcon',
  'outline:DocumentTextIcon',
  'outline:PhotoIcon',
  'outline:VideoCameraIcon',
  'outline:MusicalNoteIcon',
  'outline:CloudIcon',
  'outline:ArchiveBoxIcon',
  'outline:BookmarkIcon',
  'outline:GlobeAltIcon',
  'outline:UserIcon',
  'outline:UsersIcon',
  'outline:BuildingOfficeIcon',
  'outline:BriefcaseIcon',
  'outline:Cog6ToothIcon',
  'outline:WrenchIcon',
  'outline:CreditCardIcon',
  'outline:InboxIcon',
  'outline:CalendarIcon',
  'outline:EnvelopeIcon',
  'outline:MapPinIcon',
  'outline:AcademicCapIcon',
  'outline:TagIcon',
  'outline:ShieldCheckIcon',
  'outline:ChartBarIcon',
  'outline:ClipboardDocumentIcon',
  'outline:RectangleStackIcon',
  'outline:CodeBracketIcon',
  'outline:CpuChipIcon',
  'outline:ServerIcon',
  'outline:ComputerDesktopIcon',
  'outline:FolderOpenIcon',
  'outline:GiftIcon',
  'outline:TruckIcon',
].map((value) => ({
  value,
  component: resolveIconComponent(value),
}));
</script>

<template>
  <ModalDialog v-model="isFavoriteEditorOpen">
    <template #title>
      {{ t('favorites.editTitle')}}
    </template>
    <div class="space-y-4">
      <div>
        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">
          {{ t('favorites.path')}}
        </label>
        <input
          v-model="editorPath"
          type="text"
          class="w-full rounded-md border border-zinc-300 bg-zinc-100 px-2 py-1.5 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          disabled
        >
      </div>
      <div>
        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">
          {{ t('favorites.name')}}
        </label>
        <input
          v-model="editorName"
          type="text"
          class="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
      </div>
      <div>
        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-2">
          {{ t('favorites.icon')}}
        </label>
        <div class="max-h-32 overflow-y-hidden hover:overflow-y-auto pr-1">
          <div class="flex flex-wrap gap-2 p-1">
            <button
              v-for="option in favoriteIconOptions"
              :key="option.value"
              type="button"
              class="flex h-10 w-10 items-center justify-center rounded-md border text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
              :class="option.value === editorIcon ? 'border-blue-500 ring-2 ring-blue-400 dark:border-blue-400' : 'border-zinc-300'"
              @click="editorIcon = option.value"
            >
              <component :is="option.component" class="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
      <div class="mt-4 flex justify-end gap-3">
        <button
          type="button"
          class="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          @click="closeFavoriteEditor"
          :disabled="isSaving"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500 active:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400"
          @click="saveFavoriteEditor"
          :disabled="isSaving"
        >
          <span v-if="isSaving">{{ t('common.saving') || 'Saving…' }}</span>
          <span v-else>{{ t('common.save') }}</span>
        </button>
      </div>
    </div>
  </ModalDialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
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
  editorIconVariant,
  editorColor,
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

const ICON_NAMES = [
  'StarIcon',
  'FolderIcon',
  'HomeIcon',
  'HeartIcon',
  'DocumentTextIcon',
  'PhotoIcon',
  'VideoCameraIcon',
  'MusicalNoteIcon',
  'CloudIcon',
  'ArchiveBoxIcon',
  'BookmarkIcon',
  'GlobeAltIcon',
  'UserIcon',
  'UsersIcon',
  'BuildingOfficeIcon',
  'BriefcaseIcon',
  'Cog6ToothIcon',
  'WrenchIcon',
  'CreditCardIcon',
  'InboxIcon',
  'CalendarIcon',
  'EnvelopeIcon',
  'MapPinIcon',
  'AcademicCapIcon',
  'TagIcon',
  'ShieldCheckIcon',
  'ChartBarIcon',
  'ClipboardDocumentIcon',
  'RectangleStackIcon',
  'CodeBracketIcon',
  'CpuChipIcon',
  'ServerIcon',
  'ComputerDesktopIcon',
  'FolderOpenIcon',
  'GiftIcon',
  'TruckIcon',
];

const COLOR_PALETTE = [
  { name: 'Red', value: '#ff5e5a' },
  { name: 'Orange', value: '#ffb000' },
  { name: 'Yellow', value: '#ffde00' },
  { name: 'Green', value: '#0bd336' },
  { name: 'Blue', value: '#009cff' },
  { name: 'Purple', value: '#d873fb' },
];

const favoriteIconOptions = computed(() =>
  ICON_NAMES.map((iconName) => ({
    value: iconName,
    component: resolveIconComponent(`${editorIconVariant.value}:${iconName}`),
  })),
);
</script>

<template>
  <ModalDialog v-model="isFavoriteEditorOpen">
    <template #title>
      {{ t('favorites.editTitle') }}
    </template>
    <div class="space-y-4">
      <div>
        <label
          class="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1"
        >
          {{ t('common.path') }}
        </label>
        <input
          v-model="editorPath"
          type="text"
          class="w-full rounded-md border border-zinc-300 bg-zinc-100 px-2 py-1.5 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          disabled
        />
      </div>
      <div>
        <label
          class="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1"
        >
          {{ t('common.name') }}
        </label>
        <input
          v-model="editorName"
          type="text"
          class="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>
      <div>
        <label
          class="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-2"
        >
          {{ t('favorites.icon') }}
        </label>

        <!-- Icon Variant Toggle and Color Palette - Combined Row -->
        <div class="mb-3 flex items-center justify-between gap-4">
          <!-- Icon Variant Toggle -->
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-md border px-3 py-1.5 text-xs font-medium transition"
              :class="
                editorIconVariant === 'outline-solid'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-300'
                  : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
              "
              @click="editorIconVariant = 'outline-solid'"
            >
              Outline
            </button>
            <button
              type="button"
              class="rounded-md border px-3 py-1.5 text-xs font-medium transition"
              :class="
                editorIconVariant === 'solid'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-300'
                  : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
              "
              @click="editorIconVariant = 'solid'"
            >
              Solid
            </button>
          </div>

          <!-- Color Palette -->
          <div class="flex gap-2 items-center">
            <!-- Default (No color) option -->
            <button
              type="button"
              class="flex h-7 w-7 items-center justify-center rounded-md border-2 transition hover:scale-110"
              :class="
                !editorColor
                  ? 'border-blue-500 ring-2 ring-blue-400 dark:border-blue-400'
                  : 'border-zinc-300 dark:border-zinc-600'
              "
              @click="editorColor = null"
              title="Default"
            >
              <div
                class="h-5 w-5 rounded-xs bg-linear-to-br from-zinc-300 to-zinc-500 dark:from-zinc-600 dark:to-zinc-400"
              ></div>
            </button>

            <!-- Color options -->
            <button
              v-for="color in COLOR_PALETTE"
              :key="color.value"
              type="button"
              class="h-7 w-7 rounded-md border-2 transition hover:scale-110"
              :class="
                editorColor === color.value
                  ? 'border-blue-500 ring-2 ring-blue-400 dark:border-blue-400'
                  : 'border-zinc-300 dark:border-zinc-600'
              "
              :style="{ backgroundColor: color.value }"
              @click="editorColor = color.value"
              :title="color.name"
            ></button>
          </div>
        </div>

        <div class="max-h-32 overflow-y-hidden hover:overflow-y-auto pr-1">
          <div class="flex flex-wrap gap-2 p-1">
            <button
              v-for="option in favoriteIconOptions"
              :key="option.value"
              type="button"
              class="flex h-10 w-10 items-center justify-center rounded-md border text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
              :class="
                option.value === editorIcon
                  ? 'border-blue-500 ring-2 ring-blue-400 dark:border-blue-400'
                  : 'border-zinc-300'
              "
              @click="editorIcon = option.value"
            >
              <component
                :is="option.component"
                class="h-5 w-5"
                :style="{ color: editorColor || 'currentColor' }"
              />
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

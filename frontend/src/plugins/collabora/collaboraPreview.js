import { useFeaturesStore } from '@/stores/features';
import { useSettingsStore } from '@/stores/settings';

const DEFAULT_EXTS = [
  'docx',
  'doc',
  'odt',
  'rtf',
  'txt',
  'xlsx',
  'xls',
  'ods',
  'csv',
  'pptx',
  'ppt',
  'odp',
];

export const collaboraPreviewPlugin = (extensions) => ({
  id: 'collabora-editor',
  label: 'Collabora',
  priority: 50,
  minimalHeader: true,

  match: (context) => {
    const ext = String(context.extension || '').toLowerCase();
    const list = Array.isArray(extensions) && extensions.length > 0 ? extensions : DEFAULT_EXTS;
    if (!list.includes(ext)) return false;

    const featuresStore = useFeaturesStore();
    const hasBothEditors = Boolean(
      featuresStore.onlyofficeEnabled && featuresStore.collaboraEnabled
    );
    if (!hasBothEditors) return true;

    const settingsStore = useSettingsStore();
    return settingsStore.officeEditorPreference === 'collabora';
  },

  component: () => import('./CollaboraPreview.vue'),

  actions: (context) => [
    {
      id: 'download',
      label: 'Download',
      run: () => context.api.download(),
    },
  ],
});

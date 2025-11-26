<script setup>
import { computed, ref, watchEffect } from 'vue';

import { apiBase } from '@/api';
import { useAppSettings } from '@/stores/appSettings';
import { useFileStore } from '@/stores/fileStore';
import { isPreviewableImage, isPreviewableVideo } from '@/config/media';

import TxtIcon from './files/txt-icon.vue';
import DirectoryIcon from './files/directory-icon.vue';
import CodeIcon from './files/code-icon.vue';
import PdfIcon from './files/pdf-icon.vue';
import FileBadgeIcon from './files/FileBadgeIcon.vue';
import ImageIcon from './files/image-icon.vue';
import VideoIcon from './files/video-icon.vue';
import AudioIcon from './files/audio-icon.vue';
import ArchiveIcon from './files/archive-icon.vue';

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
  // Add prop to disable thumbnail loading for search results
  disableThumbnails: {
    type: Boolean,
    default: false,
  },
});

const fileStore = useFileStore();
const appSettings = useAppSettings();

// Load settings once if needed
if (!appSettings.loaded && !appSettings.loading) {
  appSettings.load();
}

const thumbnailUrl = computed(() => {
  // Early exit if thumbnails disabled via prop
  if (props.disableThumbnails) {
    return null;
  }

  const kind = (props.item?.kind || '').toLowerCase();
  if (kind === 'pdf') {
    return null;
  }

  const thumbnailPath = props.item?.thumbnail;
  if (!thumbnailPath) {
    return null;
  }

  // If settings are loaded and thumbnails are disabled, do not show
  if (appSettings.loaded && appSettings.state.thumbnails?.enabled === false) {
    return null;
  }

  if (/^https?:\/\//i.test(thumbnailPath)) {
    return thumbnailPath;
  }

  return `${apiBase}${thumbnailPath}`;
});

const ext = computed(() => (props.item?.kind || '').toLowerCase());

const isPreviewable = computed(() => {
  if (!ext.value) {
    return false;
  }

  if (ext.value === 'pdf') {
    return false;
  }

  return isPreviewableImage(ext.value) || isPreviewableVideo(ext.value);
});

// Track if we've already requested the thumbnail
const hasRequestedThumbnail = ref(false);

// Automatically request thumbnail when all conditions are met
// watchEffect automatically tracks all reactive dependencies and re-runs when they change
watchEffect(() => {
  // Exit early if already requested
  if (hasRequestedThumbnail.value) return;

  // Check all conditions
  if (props.disableThumbnails) return;
  if (!props.item || props.item.kind === 'directory') return;
  if (!isPreviewable.value) return;
  if (!appSettings.loaded) return;
  if (appSettings.state.thumbnails?.enabled === false) return;
  if (props.item.thumbnail) return;
  if (!props.item.supportsThumbnail) return;

  // All conditions met - request thumbnail once
  hasRequestedThumbnail.value = true;
  fileStore.ensureItemThumbnail(props.item);
});

// Additional type groupings
const audioExts = new Set(['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'wma']);
const archiveExts = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz']);

// Badge mapping for many common types
const badge = computed(() => {
  const e = ext.value;
  switch (e) {
    // Documents
    case 'doc':
    case 'docx':
    case 'rtf':
      return { label: 'DOC', bg: '#2563EB', fg: '#FFFFFF' };
    case 'xls':
    case 'xlsx':
      return { label: 'XLS', bg: '#16A34A', fg: '#FFFFFF' };
    case 'ppt':
    case 'pptx':
      return { label: 'PPT', bg: '#F97316', fg: '#FFFFFF' };
    case 'csv':
      return { label: 'CSV', bg: '#22C55E', fg: '#FFFFFF' };
    case 'txt':
      return { label: 'TXT', bg: '#6B7280', fg: '#FFFFFF' };
    case 'md':
    case 'markdown':
      return { label: 'MD', bg: '#0EA5E9', fg: '#FFFFFF' };

    // Web & styles
    case 'html':
    case 'htm':
      return { label: 'HTML', bg: '#E44D26', fg: '#FFFFFF' };
    case 'css':
      return { label: 'CSS', bg: '#2965F1', fg: '#FFFFFF' };
    case 'scss':
      return { label: 'SCSS', bg: '#C6538C', fg: '#FFFFFF' };
    case 'less':
      return { label: 'LESS', bg: '#1D365D', fg: '#FFFFFF' };

    // Scripts & code
    case 'js':
      return { label: 'JS', bg: '#F7DF1E', fg: '#000000' };
    case 'ts':
      return { label: 'TS', bg: '#3178C6', fg: '#FFFFFF' };
    case 'jsx':
      return { label: 'JSX', bg: '#61DAFB', fg: '#000000' };
    case 'tsx':
      return { label: 'TSX', bg: '#3178C6', fg: '#FFFFFF' };
    case 'vue':
      return { label: 'VUE', bg: '#41B883', fg: '#0B1921' };
    case 'json':
      return { label: 'JSON', bg: '#8B5CF6', fg: '#FFFFFF' };
    case 'yml':
    case 'yaml':
      return { label: 'YAML', bg: '#14B8A6', fg: '#073B3A' };
    case 'xml':
      return { label: 'XML', bg: '#EC4899', fg: '#FFFFFF' };
    case 'sh':
    case 'bash':
    case 'zsh':
      return { label: 'SH', bg: '#374151', fg: '#FFFFFF' };
    case 'py':
      return { label: 'PY', bg: '#3776AB', fg: '#FFFFFF' };
    case 'rb':
      return { label: 'RB', bg: '#CC342D', fg: '#FFFFFF' };
    case 'php':
      return { label: 'PHP', bg: '#777BB4', fg: '#FFFFFF' };
    case 'go':
      return { label: 'GO', bg: '#00ADD8', fg: '#073B4C' };
    case 'rs':
      return { label: 'RS', bg: '#DEA584', fg: '#000000' };
    case 'java':
      return { label: 'JAVA', bg: '#E11D48', fg: '#FFFFFF' };
    case 'kt':
    case 'kts':
      return { label: 'KT', bg: '#7F52FF', fg: '#FFFFFF' };
    case 'swift':
      return { label: 'SWIFT', bg: '#FA7343', fg: '#FFFFFF' };
    case 'c':
      return { label: 'C', bg: '#5C6BC0', fg: '#FFFFFF' };
    case 'cpp':
    case 'cc':
    case 'cxx':
      return { label: 'CPP', bg: '#00599C', fg: '#FFFFFF' };
    case 'cs':
      return { label: 'CS', bg: '#239120', fg: '#FFFFFF' };

    // Data & config
    case 'sql':
      return { label: 'SQL', bg: '#0EA5E9', fg: '#FFFFFF' };
    case 'db':
    case 'sqlite':
    case 'sqlite3':
      return { label: 'DB', bg: '#0EA5E9', fg: '#FFFFFF' };
    case 'ini':
    case 'conf':
    case 'cfg':
      return { label: 'CFG', bg: '#6B7280', fg: '#FFFFFF' };
    case 'toml':
      return { label: 'TOML', bg: '#0F766E', fg: '#FFFFFF' };
    case 'env':
      return { label: 'ENV', bg: '#059669', fg: '#FFFFFF' };

    // Fonts & vector
    case 'svg':
      return { label: 'SVG', bg: '#8B5CF6', fg: '#FFFFFF' };
    case 'ttf':
    case 'otf':
    case 'woff':
    case 'woff2':
      return { label: 'FONT', bg: '#9CA3AF', fg: '#111827' };

    // Locks
    case 'lock':
      return { label: 'LOCK', bg: '#6B7280', fg: '#FFFFFF' };

    // Creative & design
    case 'psd':
      return { label: 'PSD', bg: '#001E36', fg: '#00C8FF' };
    case 'ai':
      return { label: 'AI', bg: '#300000', fg: '#FF9A00' };
    case 'fig':
      return { label: 'FIG', bg: '#A259FF', fg: '#FFFFFF' };
    case 'sketch':
      return { label: 'SKETCH', bg: '#FDB300', fg: '#111827' };

    // Packages / installers
    case 'exe':
      return { label: 'EXE', bg: '#111827', fg: '#FFFFFF' };
    case 'msi':
      return { label: 'MSI', bg: '#0EA5E9', fg: '#FFFFFF' };
    case 'apk':
      return { label: 'APK', bg: '#34D399', fg: '#073B3A' };
    case 'dmg':
      return { label: 'DMG', bg: '#6B7280', fg: '#FFFFFF' };
    case 'pkg':
      return { label: 'PKG', bg: '#F59E0B', fg: '#111827' };
    case 'deb':
      return { label: 'DEB', bg: '#CC0000', fg: '#FFFFFF' };
    case 'rpm':
      return { label: 'RPM', bg: '#EE0000', fg: '#FFFFFF' };

    // Misc
    case 'log':
      return { label: 'LOG', bg: '#9CA3AF', fg: '#111827' };
    case 'tmp':
    case 'bak':
      return { label: e.toUpperCase(), bg: '#D1D5DB', fg: '#111827' };

    default:
      return null;
  }
});
</script>

<template>
  <DirectoryIcon v-if="props.item.kind === 'directory'" />
  <PdfIcon v-else-if="props.item.kind === 'pdf'" />
  <div v-else-if="thumbnailUrl" class="flex items-center justify-center">
    <img :src="thumbnailUrl" alt="Preview thumbnail" loading="lazy" />
  </div>
  <ImageIcon v-else-if="isPreviewableImage(ext)" />
  <VideoIcon v-else-if="isPreviewableVideo(ext)" />
  <AudioIcon v-else-if="audioExts.has(ext)" />
  <ArchiveIcon v-else-if="archiveExts.has(ext)" />
  <FileBadgeIcon v-else-if="badge" v-bind="badge" />
  <CodeIcon v-else-if="['json', 'vue'].includes(props.item.kind)" />
  <TxtIcon v-else />
</template>
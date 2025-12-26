const DEFAULT_IMAGE_PREVIEW_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'svg',
  'ico',
  'tif',
  'tiff',
  'avif',
  'heic',
  'nef',
  'dng',
  'arw',
  'cr2',
  'raf',
];

const envImageExtensions = (import.meta.env.VITE_IMAGE_PREVIEW_EXTENSIONS || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const imagePreviewExtensionsSet = new Set([
  ...DEFAULT_IMAGE_PREVIEW_EXTENSIONS,
  ...envImageExtensions,
]);

const DEFAULT_VIDEO_PREVIEW_EXTENSIONS = [
  'mp4',
  'mov',
  'mkv',
  'webm',
  'm4v',
  'avi',
  'wmv',
  'flv',
  'mpg',
  'mpeg',
];

const envVideoExtensions = (import.meta.env.VITE_VIDEO_PREVIEW_EXTENSIONS || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const videoPreviewExtensionsSet = new Set([
  ...DEFAULT_VIDEO_PREVIEW_EXTENSIONS,
  ...envVideoExtensions,
]);

const DEFAULT_AUDIO_PREVIEW_EXTENSIONS = [
  'mp3',
  'wav',
  'flac',
  'aac',
  'm4a',
  'ogg',
  'opus',
  'wma',
];

const envAudioExtensions = (import.meta.env.VITE_AUDIO_PREVIEW_EXTENSIONS || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const audioPreviewExtensionsSet = new Set([
  ...DEFAULT_AUDIO_PREVIEW_EXTENSIONS,
  ...envAudioExtensions,
]);

const getImagePreviewExtensions = () =>
  Array.from(imagePreviewExtensionsSet.values());

const isPreviewableImage = (extension = '') => {
  if (!extension) return false;
  return imagePreviewExtensionsSet.has(extension.toLowerCase());
};

const getVideoPreviewExtensions = () =>
  Array.from(videoPreviewExtensionsSet.values());

const isPreviewableVideo = (extension = '') => {
  if (!extension) return false;
  return videoPreviewExtensionsSet.has(extension.toLowerCase());
};

const getAudioPreviewExtensions = () =>
  Array.from(audioPreviewExtensionsSet.values());

const isPreviewableAudio = (extension = '') => {
  if (!extension) return false;
  return audioPreviewExtensionsSet.has(extension.toLowerCase());
};

export {
  getImagePreviewExtensions,
  isPreviewableImage,
  getVideoPreviewExtensions,
  isPreviewableVideo,
  getAudioPreviewExtensions,
  isPreviewableAudio,
};

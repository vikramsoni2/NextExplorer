import { isPreviewableAudio } from '@/config/media';

/**
 * Audio preview plugin
 */
export const audioPreviewPlugin = () => ({
  id: 'core-audio-preview',
  label: 'Audio Player',
  priority: 10,

  match: (context) => isPreviewableAudio(context.extension),

  component: () => import('./AudioPreview.vue'),

  actions: (context) => [
    {
      id: 'download',
      label: 'Download',
      run: () => context.api.download(),
    },
  ],
});

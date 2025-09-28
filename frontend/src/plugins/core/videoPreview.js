import { isPreviewableVideo } from '@/config/media';

export const videoPreviewPlugin = () => ({
  id: 'core-video-preview',
  label: 'Video Preview',
  priority: 10,
  match: (ctx) => {
    if (!ctx) return false;
    return isPreviewableVideo(ctx.extension);
  },
  component: () => import('./VideoPreview.vue'),
  actions: (ctx) => {
    const path = ctx.filePath;
    if (!path) return [];
    return [
      {
        id: 'download',
        label: 'Download',
        run: () => ctx.api.download(path),
      },
    ];
  },
});

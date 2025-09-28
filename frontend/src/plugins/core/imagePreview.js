import { isPreviewableImage } from '@/config/media';

export const imagePreviewPlugin = () => ({
  id: 'core-image-preview',
  label: 'Image Preview',
  priority: 20,
  standalone: true,
  match: (ctx) => {
    if (!ctx) return false;
    return isPreviewableImage(ctx.extension);
  },
  component: () => import('./ImagePreview.vue'),
});

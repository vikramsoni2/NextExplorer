// imagePreview.js
import { isPreviewableImage } from '@/config/media';

/**
 * Image preview plugin using vue-easy-lightbox
 * Standalone mode - renders its own modal
 */
export const imagePreviewPlugin = () => ({
  id: 'core-image-preview',
  label: 'Image Preview',
  priority: 20,
  standalone: true, // Renders own modal, bypasses PreviewHost

  match: (context) => {
    return isPreviewableImage(context.extension);
  },

  component: () => import('./ImagePreview.vue'),
});

import { isPreviewableVideo } from '@/config/media';

/**
 * Video preview plugin - simplified structure
 */
export const videoPreviewPlugin = () => ({
  // Required fields
  id: 'core-video-preview',
  label: 'Video Preview',
  
  // Optional configuration
  priority: 10,
  
  // Match function - receives simple context
  match: (context) => {
    return isPreviewableVideo(context.extension);
  },
  
  // Component loader - can be sync or async
  component: () => import('./VideoPreview.vue'),
  
  actions: (context) => [
    {
      id: 'download',
      label: 'Download',
      run: () => context.api.download(),
    },
  ],
  
  // Optional lifecycle hooks
  onOpen: (context) => {
    console.log('Opening video:', context.item.name);
  },
  
  onClose: (context) => {
    console.log('Closing video:', context.item.name);
  },
});
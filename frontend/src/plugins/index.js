import { usePreviewManager } from '@/plugins/preview/manager';
import { imagePreviewPlugin } from '@/plugins/core/imagePreview';
import { videoPreviewPlugin } from '@/plugins/core/videoPreview';
import { markdownPreviewPlugin } from '@/plugins/markdown/markdownPreview';
import { pdfPreviewPlugin } from '@/plugins/pdf/pdfPreview';

export const installPreviewPlugins = (pinia, additional = []) => {
  const manager = usePreviewManager(pinia);
  const plugins = [
    imagePreviewPlugin(),
    videoPreviewPlugin(),
    pdfPreviewPlugin(),
    markdownPreviewPlugin(),
    ...additional,
  ];

  plugins
    .filter(Boolean)
    .forEach((plugin) => manager.register(plugin));
};

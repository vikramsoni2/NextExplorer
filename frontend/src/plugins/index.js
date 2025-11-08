import { usePreviewManager } from '@/plugins/preview/manager';
import { imagePreviewPlugin } from '@/plugins/core/imagePreview';
import { videoPreviewPlugin } from '@/plugins/core/videoPreview';
import { markdownPreviewPlugin } from '@/plugins/markdown/markdownPreview';
import { pdfPreviewPlugin } from '@/plugins/pdf/pdfPreview';
import { onlyofficePreviewPlugin } from '@/plugins/onlyoffice/onlyofficePreview';
import { fetchFeatures } from '@/api';

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

  // Register ONLYOFFICE preview only when enabled on the server
  // This avoids showing the integration unless ONLYOFFICE_URL is provided
  Promise.resolve()
    .then(() => fetchFeatures())
    .then((features) => {
      if (features && features.onlyoffice && features.onlyoffice.enabled) {
        const exts = Array.isArray(features.onlyoffice.extensions)
          ? features.onlyoffice.extensions.map((s) => String(s).toLowerCase())
          : [];
        manager.register(onlyofficePreviewPlugin(exts));
      }
    })
    .catch(() => { /* silently ignore */ });
};

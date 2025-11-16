import { usePreviewManager } from '@/plugins/preview/manager';
import { imagePreviewPlugin } from '@/plugins/image/imagePreview';
import { videoPreviewPlugin } from '@/plugins/video/videoPreview';
import { markdownPreviewPlugin } from '@/plugins/markdown/markdownPreview';
import { pdfPreviewPlugin } from '@/plugins/pdf/pdfPreview';
import { onlyofficePreviewPlugin } from '@/plugins/onlyoffice/onlyofficePreview';
import { useFeaturesStore } from '@/stores/features';

/**
 * @param {import('pinia').Pinia} pinia - Pinia instance
 * @param {Object} options - Installation options
 * @param {Array} options.plugins - Additional custom plugins to register
 * @param {boolean} options.skipOnlyOffice - Skip ONLYOFFICE plugin loading
 */
export const installPreviewPlugins = (pinia, options = {}) => {
  const { plugins: customPlugins = [], skipOnlyOffice = false } = options;
  const manager = usePreviewManager(pinia);

  // Register core plugins (synchronous - blocks app startup)
  registerCorePlugins(manager);

  if (customPlugins.length > 0) {
    customPlugins.forEach(plugin => {
      try {
        manager.register(plugin);
      } catch (error) {
        console.error('Failed to register custom plugin:', error);
      }
    });
  }

  // Load ONLYOFFICE asynchronously (doesn't block startup)
  if (!skipOnlyOffice) {
    loadOnlyOfficePlugin(manager);
  }
};

/**
 * Register core preview plugins
 * These are bundled and always available
 */
function registerCorePlugins(manager) {
  const plugins = [
    imagePreviewPlugin(),
    videoPreviewPlugin(),
    pdfPreviewPlugin(),
    markdownPreviewPlugin(),
  ];

  plugins.forEach(plugin => manager.register(plugin));
}

/**
 * Load ONLYOFFICE plugin conditionally based on server features
 * Runs async to avoid blocking app startup
 */
async function loadOnlyOfficePlugin(manager) {
  try {
    const featuresStore = useFeaturesStore();
    await featuresStore.ensureLoaded();

    if (!featuresStore.onlyofficeEnabled) return;

    // Get supported extensions from store
    const extensions = normalizeExtensions(featuresStore.onlyofficeExtensions);
    manager.register(onlyofficePreviewPlugin(extensions));

    console.info(`ONLYOFFICE plugin loaded (${extensions.length} extensions)`);
  } catch (error) {
    console.debug('ONLYOFFICE plugin unavailable:', error.message);
  }
}

/**
 * Normalize extension list from server
 */
function normalizeExtensions(extensions) {
  if (!Array.isArray(extensions)) {
    return [];
  }
  
  return extensions
    .filter(ext => ext && typeof ext === 'string')
    .map(ext => ext.toLowerCase().trim())
    .filter(ext => ext.length > 0);
}
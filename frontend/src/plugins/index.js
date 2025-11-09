import { usePreviewManager } from '@/plugins/preview/manager';
import { imagePreviewPlugin } from '@/plugins/image/imagePreview';
import { videoPreviewPlugin } from '@/plugins/video/videoPreview';
import { markdownPreviewPlugin } from '@/plugins/markdown/markdownPreview';
import { pdfPreviewPlugin } from '@/plugins/pdf/pdfPreview';
import { onlyofficePreviewPlugin } from '@/plugins/onlyoffice/onlyofficePreview';
import { fetchFeatures } from '@/api';

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
    const features = await fetchFeatures();

    console.log(features);
    // Exit early if not enabled
    if (!features?.onlyoffice?.enabled) {
      return;
    }

    // Get supported extensions from server
    const extensions = normalizeExtensions(features.onlyoffice.extensions);

    // Register plugin
    manager.register(onlyofficePreviewPlugin(extensions));
    
    console.info(`✓ ONLYOFFICE plugin loaded (${extensions.length} extensions)`);
  } catch (error) {
    // Fail silently - ONLYOFFICE is optional
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
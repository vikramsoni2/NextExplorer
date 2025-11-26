const storage = require('./storage/jsonStorage');
const { normalizeRelativePath } = require('../utils/pathUtils');

/**
 * Sanitize thumbnail settings
 */
const sanitizeThumbnails = (thumbnails = {}) => {
  return {
    enabled: typeof thumbnails.enabled === 'boolean' ? thumbnails.enabled : true,
    size: Number.isFinite(thumbnails.size)
      ? Math.max(64, Math.min(1024, Math.floor(thumbnails.size)))
      : 200,
    quality: Number.isFinite(thumbnails.quality)
      ? Math.max(1, Math.min(100, Math.floor(thumbnails.quality)))
      : 70,
    concurrency: Number.isFinite(thumbnails.concurrency)
      ? Math.max(1, Math.min(50, Math.floor(thumbnails.concurrency)))
      : 10,
  };
};

/**
 * Sanitize access control rules
 */
const sanitizeAccessRules = (rules = []) => {
  if (!Array.isArray(rules)) return [];
  
  return rules
    .map(rule => {
      if (!rule || typeof rule !== 'object') return null;
      
      // Validate path
      let normalizedPath;
      try {
        normalizedPath = normalizeRelativePath(rule.path || '');
      } catch {
        return null; // Invalid path
      }
      
      if (!normalizedPath) return null;
      
      // Validate permissions
      const permissions = ['rw', 'ro', 'hidden'].includes(rule.permissions) 
        ? rule.permissions 
        : 'rw';
      
      return {
        id: rule.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        path: normalizedPath,
        recursive: Boolean(rule.recursive),
        permissions,
      };
    })
    .filter(Boolean);
};

/**
 * Sanitize complete settings object
 */
const sanitize = (settings) => {
  return {
    thumbnails: sanitizeThumbnails(settings?.thumbnails),
    access: {
      rules: sanitizeAccessRules(settings?.access?.rules),
    },
  };
};

/**
 * Get current settings
 */
const getSettings = async () => {
  const data = await storage.get();
  return data.settings || {
    thumbnails: { enabled: true, size: 200, quality: 70, concurrency: 10 },
    access: { rules: [] },
  };
};

/**
 * Update settings with partial data
 * Deep merges with existing settings
 */
const setSettings = async (partial) => {
  const current = await getSettings();
  
  // Deep merge
  const merged = {
    thumbnails: { ...current.thumbnails, ...(partial.thumbnails || {}) },
    access: {
      rules: partial.access?.rules !== undefined 
        ? partial.access.rules 
        : current.access.rules,
    },
  };
  
  // Sanitize and save
  const updated = await storage.update((data) => ({
    ...data,
    settings: sanitize(merged),
  }));
  
  return updated.settings;
};

/**
 * Update settings with an updater function
 */
const updateSettings = async (updater) => {
  const current = await getSettings();
  const next = typeof updater === 'function' ? updater(current) : current;
  return setSettings(next);
};

module.exports = { 
  getSettings, 
  setSettings, 
  updateSettings,
};
const { getDb } = require('./db');
const { normalizeRelativePath } = require('../utils/pathUtils');
const storage = require('./storage/jsonStorage'); // Keep for backward compatibility fallback

const generateId = () => {
  const crypto = require('crypto');
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}`;
};

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
    .map((rule) => {
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
 * Sanitize branding settings
 */
const sanitizeBranding = (branding = {}) => {
  return {
    appName: typeof branding.appName === 'string' 
      ? branding.appName.trim().slice(0, 100) 
      : 'Explorer',
    appLogoUrl: typeof branding.appLogoUrl === 'string' 
      ? branding.appLogoUrl.trim().slice(0, 500) 
      : '/logo.svg',
    showPoweredBy: typeof branding.showPoweredBy === 'boolean' 
      ? branding.showPoweredBy 
      : false,
  };
};

/**
 * Get public settings (branding only, no auth required)
 */
const getPublicSettings = async () => {
  try {
    const db = await getDb();
    const brandingRow = db
      .prepare('SELECT value FROM system_settings WHERE category = ? AND key = ?')
      .get('branding', 'branding');

    if (brandingRow) {
      const branding = JSON.parse(brandingRow.value);
      return {
        branding: sanitizeBranding(branding),
      };
    }
  } catch (err) {
    // Fallback to JSON if DB read fails
  }

  // Fallback to JSON storage
  try {
    const data = await storage.get();
    const branding = data.settings?.branding || {};
    return {
      branding: sanitizeBranding(branding),
    };
  } catch (err) {
    // Return defaults if all else fails
    return {
      branding: sanitizeBranding({}),
    };
  }
};

/**
 * Get user-specific settings
 */
const getUserSettings = async (userId) => {
  if (!userId) return {};

  try {
    const db = await getDb();
    const rows = db
      .prepare('SELECT key, value FROM user_settings WHERE user_id = ?')
      .all(userId);

    const settings = {};
    for (const row of rows) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch (err) {
        // Skip invalid JSON
      }
    }

    return settings;
  } catch (err) {
    return {};
  }
};

/**
 * Get system settings (admin only)
 */
const getSystemSettings = async () => {
  try {
    const db = await getDb();
    const rows = db
      .prepare('SELECT key, value FROM system_settings WHERE category = ?')
      .all('system');

    const thumbnails = { enabled: true, size: 200, quality: 70, concurrency: 10 };
    const access = { rules: [] };

    for (const row of rows) {
      try {
        if (row.key === 'thumbnails') {
          Object.assign(thumbnails, JSON.parse(row.value));
        } else if (row.key === 'access') {
          const accessData = JSON.parse(row.value);
          if (accessData.rules) {
            access.rules = accessData.rules;
          }
        }
      } catch (err) {
        // Skip invalid JSON
      }
    }

    return {
      thumbnails: sanitizeThumbnails(thumbnails),
      access: {
        rules: sanitizeAccessRules(access.rules),
      },
    };
  } catch (err) {
    // Fallback to JSON storage
    try {
      const data = await storage.get();
      const settings = data.settings || {};
      return {
        thumbnails: sanitizeThumbnails(settings.thumbnails),
        access: {
          rules: sanitizeAccessRules(settings.access?.rules || []),
        },
      };
    } catch (err2) {
      // Return defaults
      return {
        thumbnails: sanitizeThumbnails({}),
        access: { rules: [] },
      };
    }
  }
};

/**
 * Get settings for a user based on their role
 * - Public: branding only
 * - Regular user: branding + user settings
 * - Admin: branding + user settings + system settings
 */
const getSettingsForUser = async (user) => {
  const publicSettings = await getPublicSettings();
  const result = {
    branding: publicSettings.branding,
  };

  if (user && user.id) {
    const userSettings = await getUserSettings(user.id);
    result.user = userSettings;

    const isAdmin = Array.isArray(user.roles) && user.roles.includes('admin');
    if (isAdmin) {
      const systemSettings = await getSystemSettings();
      result.thumbnails = systemSettings.thumbnails;
      result.access = systemSettings.access;
    }
  }

  return result;
};

/**
 * Set a user setting
 */
const setUserSetting = async (userId, key, value) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  const db = await getDb();
  const now = new Date().toISOString();

  // Validate and sanitize value based on key
  let sanitizedValue = value;
  if (key === 'showHiddenFiles' || key === 'showThumbnails') {
    sanitizedValue = Boolean(value);
  } else if (key === 'defaultShareExpiration') {
    // Validate expiration object: { value: number, unit: 'days'|'weeks'|'months' } or null
    if (value === null || value === undefined) {
      sanitizedValue = null;
    } else if (typeof value === 'object' && value !== null) {
      const validUnits = ['days', 'weeks', 'months'];
      const unit = validUnits.includes(value.unit) ? value.unit : 'weeks';
      const numValue = Number.isFinite(value.value) && value.value > 0 ? Math.floor(value.value) : null;
      sanitizedValue = numValue ? { value: numValue, unit } : null;
    } else {
      sanitizedValue = null;
    }
  } else if (key === 'skipHome') {
    // Can be null (use env), true, or false
    if (value === null || value === undefined) {
      sanitizedValue = null;
    } else {
      sanitizedValue = Boolean(value);
    }
  }

  const valueJson = JSON.stringify(sanitizedValue);

  // Check if setting exists
  const existing = db
    .prepare('SELECT id FROM user_settings WHERE user_id = ? AND key = ?')
    .get(userId, key);

  if (existing) {
    db.prepare(
      'UPDATE user_settings SET value = ?, updated_at = ? WHERE user_id = ? AND key = ?'
    ).run(valueJson, now, userId, key);
  } else {
    db.prepare(
      'INSERT INTO user_settings (id, user_id, key, value, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(generateId(), userId, key, valueJson, now);
  }

  return sanitizedValue;
};

/**
 * Set a system setting (admin only)
 */
const setSystemSetting = async (category, key, value) => {
  if (category !== 'branding' && category !== 'system') {
    throw new Error('Invalid category. Must be "branding" or "system"');
  }

  const db = await getDb();
  const now = new Date().toISOString();

  // Sanitize based on key
  let sanitizedValue = value;
  if (key === 'thumbnails') {
    sanitizedValue = sanitizeThumbnails(value);
  } else if (key === 'access') {
    sanitizedValue = {
      rules: sanitizeAccessRules(value.rules || []),
    };
  } else if (key === 'branding') {
    sanitizedValue = sanitizeBranding(value);
  }

  const valueJson = JSON.stringify(sanitizedValue);

  // Check if setting exists
  const existing = db
    .prepare('SELECT id FROM system_settings WHERE category = ? AND key = ?')
    .get(category, key);

  if (existing) {
    db.prepare(
      'UPDATE system_settings SET value = ?, updated_at = ? WHERE category = ? AND key = ?'
    ).run(valueJson, now, category, key);
  } else {
    db.prepare(
      'INSERT INTO system_settings (id, category, key, value, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(generateId(), category, key, valueJson, now);
  }

  return sanitizedValue;
};

/**
 * Legacy method: Get all settings (for backward compatibility)
 * Returns system settings + branding
 */
const getSettings = async () => {
  const systemSettings = await getSystemSettings();
  const publicSettings = await getPublicSettings();

  return {
    ...systemSettings,
    branding: publicSettings.branding,
  };
};

/**
 * Legacy method: Set settings (for backward compatibility)
 * Updates system settings and branding
 */
const setSettings = async (partial) => {
  const current = await getSettings();

  // Deep merge
  const merged = {
    thumbnails: { ...current.thumbnails, ...(partial.thumbnails || {}) },
    access: {
      rules: partial.access?.rules !== undefined ? partial.access.rules : current.access.rules,
    },
    branding: { ...current.branding, ...(partial.branding || {}) },
  };

  // Save to DB
  if (partial.thumbnails) {
    await setSystemSetting('system', 'thumbnails', merged.thumbnails);
  }
  if (partial.access) {
    await setSystemSetting('system', 'access', merged.access);
  }
  if (partial.branding) {
    await setSystemSetting('branding', 'branding', merged.branding);
  }

  // Also update JSON for backward compatibility during transition
  try {
    await storage.update((data) => ({
      ...data,
      settings: {
        thumbnails: merged.thumbnails,
        access: merged.access,
        branding: merged.branding,
      },
    }));
  } catch (err) {
    // Non-fatal, continue
  }

  return merged;
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
  getPublicSettings,
  getUserSettings,
  getSystemSettings,
  getSettingsForUser,
  setUserSetting,
  setSystemSetting,
  // Legacy methods for backward compatibility
  getSettings,
  setSettings,
  updateSettings,
};

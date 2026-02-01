const express = require('express');
const {
  getPublicSettings,
  getSettingsForUser,
  setUserSetting,
  setSystemSetting,
  getSettings,
  setSettings,
} = require('../services/settingsService');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const { ForbiddenError } = require('../errors/AppError');

const router = express.Router();

const DEFAULT_LOGO_URL = '/logo.svg';

const deleteCustomLogoFiles = async () => {
  const configDir = process.env.CONFIG_DIR || '/config';
  const logoDir = path.join(configDir, 'logos');
  const candidates = ['custom-logo.svg', 'custom-logo.png', 'custom-logo.jpg'];

  await Promise.all(
    candidates.map(async (filename) => {
      const filePath = path.join(logoDir, filename);
      try {
        await fs.unlink(filePath);
        logger.info('Deleted custom logo file', { filename });
      } catch (error) {
        if (error && error.code === 'ENOENT') return;
        logger.warn('Failed to delete custom logo file', { filename, error: error?.message });
      }
    })
  );
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  if (!roles.includes('admin')) {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
};

// Configure multer for logo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/svg+xml', 'image/png', 'image/jpeg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only SVG, PNG, and JPG are allowed.'));
    }
  },
});

/**
 * GET /api/branding
 * Returns public branding settings (no auth required)
 * Used for displaying branding on login page and public pages
 */
router.get(
  '/branding',
  asyncHandler(async (req, res) => {
    const publicSettings = await getPublicSettings();
    res.json(publicSettings.branding);
  })
);

/**
 * GET /api/settings
 * Returns settings based on user role:
 * - No auth: public settings (branding only)
 * - Authenticated user: branding + user settings
 * - Admin: branding + user settings + system settings
 */
router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const settings = await getSettingsForUser(req.user);
    res.json(settings);
  })
);

/**
 * POST /api/settings/upload-logo
 * Upload a custom logo file (admin only)
 */
router.post(
  '/settings/upload-logo',
  requireAdmin,
  upload.single('logo'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const configDir = process.env.CONFIG_DIR || '/config';
      const logoDir = path.join(configDir, 'logos');
      
      // Create logos directory if it doesn't exist
      await fs.mkdir(logoDir, { recursive: true });

      // Generate filename based on MIME type
      let filename = 'custom-logo';
      if (req.file.mimetype === 'image/svg+xml') {
        filename += '.svg';
      } else if (req.file.mimetype === 'image/png') {
        filename += '.png';
      } else if (req.file.mimetype === 'image/jpeg') {
        filename += '.jpg';
      }

      const logoPath = path.join(logoDir, filename);
      
      // Write file to disk
      await fs.writeFile(logoPath, req.file.buffer);

      logger.info('Logo uploaded successfully', {
        filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });

      // Return the URL path for the uploaded logo
      const logoUrl = `/static/logos/${filename}`;
      res.json({ logoUrl });
    } catch (error) {
      logger.error('Logo upload error', { error: error.message });
      res.status(500).json({ error: 'Failed to save logo' });
    }
  })
);

/**
 * PATCH /api/settings
 * Update settings with partial data
 * - Users can update their own user settings (user.*)
 * - Admins can update system settings (thumbnails, access, branding)
 */
router.patch(
  '/settings',
  asyncHandler(async (req, res) => {
    const payload = req.body || {};
    const user = req.user;
    const isAdmin = user && Array.isArray(user.roles) && user.roles.includes('admin');
    const updated = {};

    // User settings (all authenticated users can update)
    if (payload.user && typeof payload.user === 'object' && user && user.id) {
      const userUpdates = {};
      for (const [key, value] of Object.entries(payload.user)) {
        if (
          key === 'showHiddenFiles' ||
          key === 'showThumbnails' ||
          key === 'defaultShareExpiration' ||
          key === 'skipHome'
        ) {
          await setUserSetting(user.id, key, value);
          userUpdates[key] = value;
        }
      }
      if (Object.keys(userUpdates).length > 0) {
        updated.user = userUpdates;
      }
    }

    // System settings (admin only)
    if (isAdmin) {
      const systemUpdates = {};

      // Thumbnails settings
      if (payload.thumbnails && typeof payload.thumbnails === 'object') {
        const thumbnailsUpdate = {};
        if (payload.thumbnails.enabled != null) {
          thumbnailsUpdate.enabled = Boolean(payload.thumbnails.enabled);
        }
        if (Number.isFinite(payload.thumbnails.size)) {
          thumbnailsUpdate.size = payload.thumbnails.size;
        }
        if (Number.isFinite(payload.thumbnails.quality)) {
          thumbnailsUpdate.quality = payload.thumbnails.quality;
        }
        if (Number.isFinite(payload.thumbnails.concurrency)) {
          thumbnailsUpdate.concurrency = payload.thumbnails.concurrency;
        }
        if (Object.keys(thumbnailsUpdate).length > 0) {
          const current = await getSettings();
          await setSystemSetting('system', 'thumbnails', {
            ...current.thumbnails,
            ...thumbnailsUpdate,
          });
          systemUpdates.thumbnails = { ...current.thumbnails, ...thumbnailsUpdate };
        }
      }

      // Access control rules
      if (payload.access && typeof payload.access === 'object') {
        if (Array.isArray(payload.access.rules)) {
          await setSystemSetting('system', 'access', { rules: payload.access.rules });
          systemUpdates.access = { rules: payload.access.rules };
        }
      }

      // Branding settings
      if (payload.branding && typeof payload.branding === 'object') {
        const brandingUpdate = {};
        if (typeof payload.branding.appName === 'string') {
          brandingUpdate.appName = payload.branding.appName;
        }
        if (typeof payload.branding.appLogoUrl === 'string') {
          brandingUpdate.appLogoUrl = payload.branding.appLogoUrl;
        }
        if (typeof payload.branding.showPoweredBy === 'boolean') {
          brandingUpdate.showPoweredBy = payload.branding.showPoweredBy;
        }
        if (Object.keys(brandingUpdate).length > 0) {
          const current = await getSettings();
          await setSystemSetting('branding', 'branding', {
            ...current.branding,
            ...brandingUpdate,
          });
          systemUpdates.branding = { ...current.branding, ...brandingUpdate };
        }
      }

      if (Object.keys(systemUpdates).length > 0) {
        Object.assign(updated, systemUpdates);
      }

      // Handle logo deletion if resetting to default
      const requestedLogoUrl =
        typeof payload.branding?.appLogoUrl === 'string'
          ? payload.branding.appLogoUrl.trim()
          : null;
      const resetToDefault =
        requestedLogoUrl != null &&
        (requestedLogoUrl === '' || requestedLogoUrl === DEFAULT_LOGO_URL);
      if (resetToDefault) {
        await deleteCustomLogoFiles();
      }
    } else if (payload.thumbnails || payload.access || payload.branding) {
      // Non-admin trying to update system settings
      return res.status(403).json({ error: 'Admin access required for system settings.' });
    }

    // Return updated settings
    const finalSettings = await getSettingsForUser(user);
    res.json(finalSettings);
  })
);

module.exports = router;

const express = require('express');
const { getSettings, setSettings } = require('../services/settingsService');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const { ForbiddenError } = require('../errors/AppError');

const router = express.Router();

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
    const settings = await getSettings();
    // Only return branding, not other admin settings
    res.json(
      settings.branding || { appName: 'Explorer', appLogoUrl: '/logo.svg', showPoweredBy: false }
    );
  })
);

/**
 * GET /api/settings
 * Returns current user-configurable settings (admin only)
 */
router.get(
  '/settings',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
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
 * Update settings with partial data (admin only)
 * Validates and merges with existing settings
 */
router.patch(
  '/settings',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payload = req.body || {};

    // Build partial update object
    const updates = {};

    // Thumbnails settings
    if (payload.thumbnails && typeof payload.thumbnails === 'object') {
      updates.thumbnails = {};
      if (payload.thumbnails.enabled != null) {
        updates.thumbnails.enabled = Boolean(payload.thumbnails.enabled);
      }
      if (Number.isFinite(payload.thumbnails.size)) {
        updates.thumbnails.size = payload.thumbnails.size;
      }
      if (Number.isFinite(payload.thumbnails.quality)) {
        updates.thumbnails.quality = payload.thumbnails.quality;
      }
    }

    // Access control rules
    if (payload.access && typeof payload.access === 'object') {
      if (Array.isArray(payload.access.rules)) {
        updates.access = { rules: payload.access.rules };
      }
    }

     // Branding settings
     if (payload.branding && typeof payload.branding === 'object') {
       updates.branding = {};
       if (typeof payload.branding.appName === 'string') {
         updates.branding.appName = payload.branding.appName;
       }
       if (typeof payload.branding.appLogoUrl === 'string') {
         updates.branding.appLogoUrl = payload.branding.appLogoUrl;
       }
       if (typeof payload.branding.showPoweredBy === 'boolean') {
         updates.branding.showPoweredBy = payload.branding.showPoweredBy;
       }
     }

    const updated = await setSettings(updates);
    res.json(updated);
  })
);

module.exports = router;

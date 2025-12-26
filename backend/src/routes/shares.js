const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const asyncHandler = require('../utils/asyncHandler');
const {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
} = require('../errors/AppError');
const {
  createShare,
  getShareById,
  getShareByToken,
  getSharesByOwnerId,
  getSharesForUser,
  updateShare,
  deleteShare,
  verifySharePassword,
  isShareExpired,
  trackShareAccess,
  getShareStats,
} = require('../services/sharesService');
const {
  createGuestSession,
  getGuestSession,
  isGuestSessionValid,
} = require('../services/guestSessionService');
const { resolveLogicalPath, parsePathSpace } = require('../utils/pathUtils');
const { pathExists } = require('../utils/fsUtils');
const { resolvePathWithAccess } = require('../services/accessManager');
const { extensions } = require('../config/index');
const { getSettings } = require('../services/settingsService');

const router = express.Router();

/**
 * POST /api/shares - Create a new share
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedError('Authentication required');
    }

    const {
      sourcePath,
      accessMode = 'readonly',
      sharingType = 'anyone',
      password,
      userIds,
      expiresAt,
      label,
    } = req.body;

    if (!sourcePath) {
      throw new ValidationError('Source path is required');
    }

    // Parse and validate source path
    const { space, rel } = parsePathSpace(sourcePath);

    if (space === 'share') {
      throw new ValidationError('Cannot create shares from shared paths');
    }

    // Resolve the path to check if it exists
    let resolved;
    try {
      const { accessInfo, resolved: resolvedWithAccess } =
        await resolvePathWithAccess(
          { user: req.user, guestSession: req.guestSession },
          sourcePath,
        );
      if (!accessInfo?.canAccess || !resolvedWithAccess) {
        throw new ForbiddenError(accessInfo?.denialReason || 'Access denied');
      }
      if (accessMode === 'readwrite' && !accessInfo.canWrite) {
        throw new ValidationError(
          'Cannot create a read-write share for a read-only path',
        );
      }
      resolved = resolvedWithAccess;
    } catch (error) {
      if (error?.statusCode) throw error;
      throw new ValidationError('Invalid source path');
    }

    // Check if path exists
    if (!(await pathExists(resolved.absolutePath))) {
      throw new NotFoundError('Source path does not exist');
    }

    // Check if it's a directory
    const stats = await fs.stat(resolved.absolutePath);
    const isDirectory = stats.isDirectory();

    // Validate expiration date if provided
    let validExpiresAt = null;
    if (expiresAt) {
      const expiryDate = new Date(expiresAt);
      if (isNaN(expiryDate.getTime())) {
        throw new ValidationError('Invalid expiration date');
      }
      if (expiryDate <= new Date()) {
        throw new ValidationError('Expiration date must be in the future');
      }
      validExpiresAt = expiryDate.toISOString();
    }

    // Create the share
    const sourceSpaceForDb = resolved?.userVolume ? 'user_volume' : space;
    const sourcePathForDb = resolved?.userVolume
      ? `${resolved.userVolume.id}${resolved.innerRelativePath ? `/${resolved.innerRelativePath}` : ''}`
      : rel || resolved.innerRelativePath;

    const share = await createShare({
      ownerId: req.user.id,
      sourceSpace: sourceSpaceForDb,
      sourcePath: sourcePathForDb,
      isDirectory,
      accessMode,
      sharingType,
      password,
      userIds: sharingType === 'users' ? userIds : [],
      expiresAt: validExpiresAt,
      label,
    });

    // Generate share URL using PUBLIC_URL if configured, otherwise use request host
    const { public: publicConfig } = require('../config/index');
    const baseUrl =
      publicConfig.origin || `${req.protocol}://${req.get('host')}`;
    const shareUrl = `${baseUrl}/share/${share.shareToken}`;

    res.status(201).json({
      ...share,
      shareUrl,
    });
  }),
);

/**
 * GET /api/shares - List user's shares
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedError('Authentication required');
    }

    const shares = await getSharesByOwnerId(req.user.id);

    res.json({ shares });
  }),
);

/**
 * GET /api/shares/shared-with-me - List shares shared with the current user
 */
router.get(
  '/shared-with-me',
  asyncHandler(async (req, res) => {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedError('Authentication required');
    }

    const shares = await getSharesForUser(req.user.id);

    res.json({ shares });
  }),
);

/**
 * GET /api/shares/:id - Get share details (owner only)
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedError('Authentication required');
    }

    const share = await getShareById(req.params.id);

    if (!share) {
      throw new NotFoundError('Share not found');
    }

    // Only owner can view details
    if (share.ownerId !== req.user.id) {
      throw new ForbiddenError('Access denied');
    }

    // Get statistics
    const stats = await getShareStats(share.id);

    res.json({
      ...share,
      stats,
    });
  }),
);

/**
 * PUT /api/shares/:id - Update share
 */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedError('Authentication required');
    }

    const share = await getShareById(req.params.id);

    if (!share) {
      throw new NotFoundError('Share not found');
    }

    // Only owner can update
    if (share.ownerId !== req.user.id) {
      throw new ForbiddenError('Access denied');
    }

    const updates = {};

    if ('accessMode' in req.body) {
      updates.accessMode = req.body.accessMode;
    }

    if ('sharingType' in req.body) {
      updates.sharingType = req.body.sharingType;
    }

    if ('password' in req.body) {
      updates.password = req.body.password;
    }

    if ('expiresAt' in req.body) {
      if (req.body.expiresAt) {
        const expiryDate = new Date(req.body.expiresAt);
        if (isNaN(expiryDate.getTime())) {
          throw new ValidationError('Invalid expiration date');
        }
        updates.expiresAt = expiryDate.toISOString();
      } else {
        updates.expiresAt = null;
      }
    }

    if ('label' in req.body) {
      updates.label = req.body.label;
    }

    if ('userIds' in req.body) {
      updates.userIds = req.body.userIds;
    }

    const updated = await updateShare(share.id, updates);

    res.json(updated);
  }),
);

/**
 * DELETE /api/shares/:id - Delete share
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedError('Authentication required');
    }

    const share = await getShareById(req.params.id);

    if (!share) {
      throw new NotFoundError('Share not found');
    }

    // Only owner can delete
    if (share.ownerId !== req.user.id) {
      throw new ForbiddenError('Access denied');
    }

    await deleteShare(share.id);

    res.status(204).end();
  }),
);

/**
 * GET /api/share/:token/info - Get public share info (before authentication)
 */
router.get(
  '/:token/info',
  asyncHandler(async (req, res) => {
    const share = await getShareByToken(req.params.token);

    if (!share) {
      throw new NotFoundError('Share not found');
    }

    // Return limited public info
    res.json({
      shareToken: share.shareToken,
      label: share.label,
      isDirectory: share.isDirectory,
      hasPassword: share.hasPassword,
      sharingType: share.sharingType,
      expiresAt: share.expiresAt,
      isExpired: isShareExpired(share),
    });
  }),
);

/**
 * POST /api/share/:token/verify - Verify password for password-protected share
 */
router.post(
  '/:token/verify',
  asyncHandler(async (req, res) => {
    const { password } = req.body;

    const share = await getShareByToken(req.params.token);

    if (!share) {
      throw new NotFoundError('Share not found');
    }

    if (isShareExpired(share)) {
      throw new ForbiddenError('Share has expired');
    }

    // Check if password is required
    if (!share.hasPassword) {
      // No password required, just create guest session
      if (share.sharingType === 'anyone') {
        const session = await createGuestSession({
          shareId: share.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });

        // Set guest session cookie
        res.cookie('guestSession', session.id, {
          httpOnly: true,
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          sameSite: 'lax',
          path: '/api', // Ensure cookie is sent for all /api/* requests
        });

        res.json({
          success: true,
          guestSessionId: session.id,
        });
        return;
      } else {
        // User-specific share without password still requires auth
        throw new UnauthorizedError('Authentication required');
      }
    }

    // Verify password
    const valid = await verifySharePassword(share.id, password);

    if (!valid) {
      throw new UnauthorizedError('Invalid password');
    }

    // Create guest session for anyone shares
    if (share.sharingType === 'anyone') {
      const session = await createGuestSession({
        shareId: share.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      // Set guest session cookie
      res.cookie('guestSession', session.id, {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax',
        path: '/api', // Ensure cookie is sent for all /api/* requests
      });

      res.json({
        success: true,
        guestSessionId: session.id,
      });
    } else {
      // User-specific shares still need user authentication
      res.json({
        success: true,
        requiresAuth: true,
      });
    }
  }),
);

/**
 * GET /api/share/:token/access - Access share (creates session if needed)
 */
router.get(
  '/:token/access',
  asyncHandler(async (req, res) => {
    const share = await getShareByToken(req.params.token);

    if (!share) {
      throw new NotFoundError('Share not found');
    }

    if (isShareExpired(share)) {
      throw new ForbiddenError('Share has expired');
    }

    // Track access
    await trackShareAccess(share.id);

    // Check if user has permission
    if (share.sharingType === 'users') {
      if (!req.user || !req.user.id) {
        throw new UnauthorizedError('Authentication required');
      }

      const { hasUserPermission } = require('../services/sharesService');
      const permitted = await hasUserPermission(share.id, req.user.id);

      if (!permitted) {
        throw new ForbiddenError('Access denied');
      }
    } else {
      // Anyone share - always create a new guest session for this share
      // This ensures switching between shares in the same browser works correctly
      if (!req.user) {
        // Create guest session if no password required
        if (!share.hasPassword) {
          const session = await createGuestSession({
            shareId: share.id,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
          });

          // Set guest session cookie (overwrites any existing session)
          res.cookie('guestSession', session.id, {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            sameSite: 'lax',
            path: '/api', // Ensure cookie is sent for all /api/* requests
          });

          return res.json({
            share: {
              shareToken: share.shareToken,
              label: share.label,
              sourcePath: `share/${share.shareToken}`,
              accessMode: share.accessMode,
              isDirectory: share.isDirectory,
            },
            guestSessionId: session.id,
          });
        } else {
          throw new UnauthorizedError('Password verification required');
        }
      }
    }

    // Return share access info
    res.json({
      share: {
        shareToken: share.shareToken,
        label: share.label,
        sourcePath: `share/${share.shareToken}`,
        accessMode: share.accessMode,
        isDirectory: share.isDirectory,
        expiresAt: share.expiresAt,
      },
      guestSessionId: req.guestSession?.id || null,
    });
  }),
);

/**
 * GET /api/share/:token/browse/* - Browse share contents
 *
 * For directory shares, returns the contents of the directory.
 * For file shares, treats the share as a virtual one-item directory
 * and returns a single item representing the shared file.
 *
 * Response shape matches /api/browse:
 * {
 *   items: [...],
 *   access: { canRead, canWrite, canUpload, canDelete, canShare, canDownload },
 *   path: 'share/<token>/<innerPath>'
 * }
 */
router.get(
  '/:token/browse/*',
  asyncHandler(async (req, res) => {
    const shareToken = req.params.token;
    const innerPath = req.params[0] || '';

    const logicalPath = innerPath
      ? `share/${shareToken}/${innerPath}`
      : `share/${shareToken}`;

    const context = { user: req.user, guestSession: req.guestSession };
    const { accessInfo, resolved } = await resolvePathWithAccess(
      context,
      logicalPath,
    );

    if (!accessInfo || !accessInfo.canAccess || !resolved) {
      throw new ForbiddenError(accessInfo?.denialReason || 'Access denied');
    }

    if (!(await pathExists(resolved.absolutePath))) {
      throw new NotFoundError('Path not found');
    }

    const stats = await fs.stat(resolved.absolutePath);
    const { excludedFiles } = require('../config/index');

    // Determine thumbnail settings
    const settings = await getSettings();
    const thumbsEnabled = settings?.thumbnails?.enabled !== false;
    const previewable = new Set([
      ...extensions.images,
      ...(extensions.rawImages || []),
      ...extensions.videos,
      ...(extensions.documents || []),
    ]);

    // Directory share or navigating inside a directory share
    if (stats.isDirectory()) {
      const files = await fs.readdir(resolved.absolutePath);
      const filteredFiles = files.filter(
        (file) => !excludedFiles.includes(file),
      );

      const itemsPromises = filteredFiles.map(async (file) => {
        const filePath = path.join(resolved.absolutePath, file);
        let fileStats;

        try {
          fileStats = await fs.stat(filePath);
        } catch (err) {
          return null;
        }

        const ext = fileStats.isDirectory()
          ? 'directory'
          : path.extname(file).slice(1).toLowerCase();
        const kind = ext.length > 10 ? 'unknown' : ext || 'unknown';

        const item = {
          name: file,
          path: resolved.relativePath,
          dateModified: fileStats.mtime,
          size: fileStats.size,
          kind,
          access: {
            canRead: true,
            canWrite: accessInfo.canWrite,
            canDelete: accessInfo.canDelete,
            canShare: false,
            canDownload: true,
          },
        };

        // Mark files that support thumbnails; client will lazily request them
        if (
          thumbsEnabled &&
          fileStats.isFile() &&
          kind !== 'pdf' &&
          previewable.has(kind.toLowerCase())
        ) {
          item.supportsThumbnail = true;
        }

        return item;
      });

      const items = (await Promise.all(itemsPromises)).filter(Boolean);

      const response = {
        items,
        access: {
          canRead: accessInfo.canRead,
          canWrite: accessInfo.canWrite,
          canUpload: accessInfo.canUpload,
          canDelete: accessInfo.canDelete,
          canShare: false,
          canDownload: accessInfo.canDownload,
        },
        path: resolved.relativePath,
      };

      // Add share metadata for breadcrumb display
      if (resolved?.shareInfo) {
        const share = resolved.shareInfo;
        const pathParts = (share.sourcePath || '').split('/').filter(Boolean);
        response.shareInfo = {
          label: share.label,
          sourceFolderName: pathParts[pathParts.length - 1] || '',
        };
      }

      return res.json(response);
    }

    // File share (virtual one-item directory)
    const name = path.basename(resolved.absolutePath);
    const ext = path.extname(name).slice(1).toLowerCase();
    const kind = ext.length > 10 ? 'unknown' : ext || 'unknown';

    const item = {
      name,
      path: resolved.relativePath,
      dateModified: stats.mtime,
      size: stats.size,
      kind,
      access: {
        canRead: true,
        canWrite: accessInfo.canWrite,
        canDelete: accessInfo.canDelete,
        canShare: false,
        canDownload: true,
      },
    };

    if (
      thumbsEnabled &&
      !stats.isDirectory() &&
      kind !== 'pdf' &&
      previewable.has(kind.toLowerCase())
    ) {
      item.supportsThumbnail = true;
    }

    const response = {
      items: [item],
      access: {
        canRead: accessInfo.canRead,
        canWrite: accessInfo.canWrite,
        canUpload: false,
        canDelete: accessInfo.canDelete,
        canShare: false,
        canDownload: accessInfo.canDownload,
      },
      path: resolved.relativePath,
    };

    // Add share metadata for breadcrumb display
    if (resolved?.shareInfo) {
      const share = resolved.shareInfo;
      const pathParts = (share.sourcePath || '').split('/').filter(Boolean);
      response.shareInfo = {
        label: share.label,
        sourceFolderName: pathParts[pathParts.length - 1] || '',
      };
    }

    return res.json(response);
  }),
);

module.exports = router;

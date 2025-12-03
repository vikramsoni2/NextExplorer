const { parsePathSpace, resolveLogicalPath } = require('../utils/pathUtils');
const { getPermissionForPath } = require('./accessControlService');
const {
  getShareByToken,
  hasUserPermission,
  isShareExpired,
} = require('./sharesService');

/**
 * Get comprehensive access information for a path
 * @param {Object} context - { user, guestSession, shareToken }
 * @param {string} relativePath - Logical path (e.g., 'personal/docs', 'share/abc123/file.txt')
 * @returns {Object} Access metadata
 */
const getAccessInfo = async (context, relativePath) => {
  const { space, rel, shareToken } = parsePathSpace(relativePath);

  // Determine access based on space
  switch (space) {
    case 'volume':
      return await getVolumeAccess(context, rel);
    case 'personal':
      return await getPersonalAccess(context, rel);
    case 'share':
      return await getShareAccess(context, shareToken, rel);
    default:
      return createDeniedAccess('Unknown path space');
  }
};

/**
 * Get access info for volume paths
 */
const getVolumeAccess = async (context, relativePath) => {
  const { user, guestSession } = context;

  // Guests cannot access volumes directly (only through shares)
  if (guestSession) {
    return createDeniedAccess('Guests cannot access volumes');
  }

  // Users must be authenticated
  if (!user || !user.id) {
    return createDeniedAccess('Authentication required');
  }

  // Check access control rules
  const permission = await getPermissionForPath(relativePath);
  if (permission === 'hidden') {
    return createDeniedAccess('Path is hidden');
  }

  const isReadOnly = permission === 'ro';
  const isAdmin = user.roles && user.roles.includes('admin');

  return {
    canAccess: true,
    canRead: true,
    canWrite: !isReadOnly || isAdmin,
    canDelete: !isReadOnly || isAdmin,
    canUpload: !isReadOnly || isAdmin,
    canCreateFolder: !isReadOnly || isAdmin,
    canShare: true,
    canDownload: true,
    isShared: false,
    shareInfo: null,
    effectivePermission: permission,
    denialReason: null,
  };
};

/**
 * Get access info for personal paths
 */
const getPersonalAccess = async (context, relativePath) => {
  const { user, guestSession } = context;

  // Guests cannot access personal folders
  if (guestSession) {
    return createDeniedAccess('Guests cannot access personal folders');
  }

  // Users must be authenticated
  if (!user || !user.id) {
    return createDeniedAccess('Authentication required');
  }

  // Users have full access to their own personal space
  return {
    canAccess: true,
    canRead: true,
    canWrite: true,
    canDelete: true,
    canUpload: true,
    canCreateFolder: true,
    canShare: true,
    canDownload: true,
    isShared: false,
    shareInfo: null,
    effectivePermission: 'rw',
    denialReason: null,
  };
};

/**
 * Get access info for share paths
 */
const getShareAccess = async (context, shareToken, innerPath) => {
  const { user, guestSession } = context;

  if (!shareToken) {
    return createDeniedAccess('Share token is required');
  }

  // Validate share exists
  const share = await getShareByToken(shareToken);
  if (!share) {
    return createDeniedAccess('Share not found');
  }

  // Check expiration
  if (isShareExpired(share)) {
    return createDeniedAccess('Share has expired');
  }

  // Check sharing type and permissions
  if (share.sharingType === 'users') {
    // User-specific share requires authentication
    if (!user || !user.id) {
      return createDeniedAccess('Authentication required');
    }

    // Check if user has permission
    const permitted = await hasUserPermission(share.id, user.id);
    if (!permitted) {
      return createDeniedAccess('Access denied');
    }
  } else if (share.sharingType === 'anyone') {
    // Anyone shares require either user auth OR guest session
    if (!user && !guestSession) {
      // Password verification happens during share access/login
      // If neither user nor guest session exists, they need to go through verification
      return createDeniedAccess('Share access required');
    }

    // If guest session exists, verify it belongs to this share
    if (guestSession && guestSession.shareId !== share.id) {
      return createDeniedAccess('Invalid guest session for this share');
    }
  }

  const isOwner = user && user.id === share.ownerId;
  const isReadWrite = share.accessMode === 'readwrite';

  return {
    canAccess: true,
    canRead: true,
    canWrite: isReadWrite,
    canDelete: isReadWrite,
    canUpload: isReadWrite,
    canCreateFolder: isReadWrite,
    canShare: false, // Cannot create shares within shares
    canDownload: true,
    isShared: true,
    shareInfo: {
      shareId: share.id,
      shareToken: share.shareToken,
      accessMode: share.accessMode,
      expiresAt: share.expiresAt,
      isOwner,
      label: share.label,
    },
    share, // Include full share object for path resolution (avoids duplicate DB query)
    effectivePermission: isReadWrite ? 'rw' : 'ro',
    denialReason: null,
  };
};

/**
 * Helper to create a denied access object
 */
const createDeniedAccess = (reason) => {
  return {
    canAccess: false,
    canRead: false,
    canWrite: false,
    canDelete: false,
    canUpload: false,
    canCreateFolder: false,
    canShare: false,
    canDownload: false,
    isShared: false,
    shareInfo: null,
    effectivePermission: 'hidden',
    denialReason: reason,
  };
};

/**
 * Quick check if a user/guest can access a path
 */
const canAccess = async (context, relativePath) => {
  const info = await getAccessInfo(context, relativePath);
  return info.canAccess;
};

/**
 * Check if a path can be written to
 */
const canWrite = async (context, relativePath) => {
  const info = await getAccessInfo(context, relativePath);
  return info.canWrite;
};

/**
 * Resolve a logical path to filesystem path with unified access checks.
 * - First evaluates access via getAccessInfo.
 * - If canAccess is false, returns { accessInfo, resolved: null }.
 * - If canAccess is true, resolves the logical path to an absolute path
 *   using resolveLogicalPath with the same user/guestSession context.
 *
 * @param {Object} context - { user, guestSession }
 * @param {string} relativePath - Logical path (e.g., 'personal/docs', 'share/abc123/file.txt')
 * @returns {Promise<{ accessInfo: Object, resolved: Object|null }>}
 */
const resolvePathWithAccess = async (context, relativePath) => {
  const accessInfo = await getAccessInfo(context, relativePath);

  if (!accessInfo.canAccess) {
    return { accessInfo, resolved: null };
  }

  // Pass pre-fetched share to avoid duplicate DB query
  const resolved = await resolveLogicalPath(relativePath, {
    user: context.user || null,
    guestSession: context.guestSession || null,
    share: accessInfo.share || null,
  });

  return { accessInfo, resolved };
};

/**
 * Check if user can create shares (only authenticated users, not guests)
 */
const canCreateShare = (context) => {
  const { user, guestSession } = context;

  // Guests cannot create shares
  if (guestSession) {
    return false;
  }

  // Must be authenticated
  return Boolean(user && user.id);
};

/**
 * Get context from request object
 */
const getContextFromRequest = (req) => {
  return {
    user: req.user || null,
    guestSession: req.guestSession || null,
    shareToken: req.shareToken || null,
  };
};

module.exports = {
  getAccessInfo,
  getVolumeAccess,
  getPersonalAccess,
  getShareAccess,
  canAccess,
  canWrite,
  canCreateShare,
  getContextFromRequest,
  createDeniedAccess,
  resolvePathWithAccess,
};

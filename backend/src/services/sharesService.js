const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getDb } = require('./db');

const nowIso = () => new Date().toISOString();

const generateId = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}`);

/**
 * Generate a URL-safe share token
 * Uses base62 encoding for readability (no special characters)
 */
const generateShareToken = (length = 10) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(length * 2);
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars[bytes[i] % chars.length];
  }
  return token;
};

/**
 * Convert database row to client-safe share object
 */
const toClientShare = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    shareToken: row.share_token,
    ownerId: row.owner_id,
    sourceSpace: row.source_space,
    sourcePath: row.source_path,
    isDirectory: Boolean(row.is_directory),
    accessMode: row.access_mode,
    sharingType: row.sharing_type,
    hasPassword: Boolean(row.password_hash),
    expiresAt: row.expires_at || null,
    label: row.label || null,
    downloadCount: row.download_count || 0,
    lastAccessedAt: row.last_accessed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

/**
 * Create a new share
 */
const createShare = async ({
  ownerId,
  sourceSpace,
  sourcePath,
  isDirectory = false,
  accessMode = 'readonly',
  sharingType = 'anyone',
  password = null,
  userIds = [],
  expiresAt = null,
  label = null,
}) => {
  if (!ownerId) {
    const e = new Error('Owner ID is required');
    e.status = 400;
    throw e;
  }

  if (!sourceSpace || !['volume', 'personal'].includes(sourceSpace)) {
    const e = new Error('Invalid source space');
    e.status = 400;
    throw e;
  }

  if (!sourcePath) {
    const e = new Error('Source path is required');
    e.status = 400;
    throw e;
  }

  if (!['readonly', 'readwrite'].includes(accessMode)) {
    const e = new Error('Invalid access mode');
    e.status = 400;
    throw e;
  }

  if (!['anyone', 'users'].includes(sharingType)) {
    const e = new Error('Invalid sharing type');
    e.status = 400;
    throw e;
  }

  if (sharingType === 'users' && (!Array.isArray(userIds) || userIds.length === 0)) {
    const e = new Error('At least one user is required for user-specific shares');
    e.status = 400;
    throw e;
  }

  const db = await getDb();
  const shareId = generateId();
  const shareToken = generateShareToken(10);
  const now = nowIso();
  const passwordHash = password ? bcrypt.hashSync(password, 10) : null;

  // Create share
  db.prepare(`
    INSERT INTO shares (
      id, share_token, owner_id, source_space, source_path, is_directory,
      access_mode, sharing_type, password_hash, expires_at, label,
      download_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    shareId,
    shareToken,
    ownerId,
    sourceSpace,
    sourcePath,
    isDirectory ? 1 : 0,
    accessMode,
    sharingType,
    passwordHash,
    expiresAt,
    label,
    now,
    now
  );

  // Add user permissions if user-specific share
  if (sharingType === 'users' && Array.isArray(userIds) && userIds.length > 0) {
    const insertPerm = db.prepare(`
      INSERT INTO share_permissions (id, share_id, user_id, created_at)
      VALUES (?, ?, ?, ?)
    `);

    for (const userId of userIds) {
      try {
        insertPerm.run(generateId(), shareId, userId, now);
      } catch (err) {
        // Skip duplicates
        if (!err.message.includes('UNIQUE')) {
          throw err;
        }
      }
    }
  }

  return getShareById(shareId);
};

/**
 * Get share by ID
 */
const getShareById = async (shareId) => {
  const db = await getDb();
  const row = db.prepare('SELECT * FROM shares WHERE id = ?').get(shareId);
  if (!row) return null;

  const share = toClientShare(row);

  // Add permitted users if user-specific share
  if (share.sharingType === 'users') {
    const permissions = db.prepare(`
      SELECT user_id FROM share_permissions WHERE share_id = ?
    `).all(shareId);
    share.permittedUserIds = permissions.map(p => p.user_id);
  }

  return share;
};

/**
 * Get share by token
 */
const getShareByToken = async (token) => {
  const db = await getDb();
  const row = db.prepare('SELECT * FROM shares WHERE share_token = ?').get(token);
  if (!row) return null;

  const share = toClientShare(row);

  // Add permitted users if user-specific share
  if (share.sharingType === 'users') {
    const permissions = db.prepare(`
      SELECT user_id FROM share_permissions WHERE share_id = ?
    `).all(share.id);
    share.permittedUserIds = permissions.map(p => p.user_id);
  }

  return share;
};

/**
 * Get all shares for a user
 */
const getSharesByOwnerId = async (ownerId) => {
  const db = await getDb();
  const rows = db.prepare(`
    SELECT * FROM shares WHERE owner_id = ? ORDER BY created_at DESC
  `).all(ownerId);

  return rows.map(row => {
    const share = toClientShare(row);

    // Add permitted users if user-specific share
    if (share.sharingType === 'users') {
      const permissions = db.prepare(`
        SELECT user_id FROM share_permissions WHERE share_id = ?
      `).all(share.id);
      share.permittedUserIds = permissions.map(p => p.user_id);
    }

    return share;
  });
};

/**
 * Get shares accessible by a specific user (where they're in the permissions list)
 */
const getSharesForUser = async (userId) => {
  const db = await getDb();
  const rows = db.prepare(`
    SELECT s.* FROM shares s
    INNER JOIN share_permissions sp ON s.id = sp.share_id
    WHERE sp.user_id = ?
    ORDER BY s.created_at DESC
  `).all(userId);

  // For recipients, do not expose the original source path or space.
  // Instead, expose a derived sourceName (leaf folder/file name) for display.
  return rows.map((row) => {
    const share = toClientShare(row);

    const parts = (share.sourcePath || '').split('/').filter(Boolean);
    const sourceName = parts.length ? parts[parts.length - 1] : null;

    delete share.sourcePath;
    delete share.sourceSpace;

    return {
      ...share,
      sourceName,
    };
  });
};

/**
 * Update share
 */
const updateShare = async (shareId, updates = {}) => {
  const db = await getDb();
  const existing = db.prepare('SELECT * FROM shares WHERE id = ?').get(shareId);
  if (!existing) {
    const e = new Error('Share not found');
    e.status = 404;
    throw e;
  }

  const fields = [];
  const values = [];

  if (typeof updates.accessMode === 'string' && ['readonly', 'readwrite'].includes(updates.accessMode)) {
    fields.push('access_mode = ?');
    values.push(updates.accessMode);
  }

  if (typeof updates.sharingType === 'string' && ['anyone', 'users'].includes(updates.sharingType)) {
    fields.push('sharing_type = ?');
    values.push(updates.sharingType);
  }

  if ('password' in updates) {
    const passwordHash = updates.password ? bcrypt.hashSync(updates.password, 10) : null;
    fields.push('password_hash = ?');
    values.push(passwordHash);
  }

  if ('expiresAt' in updates) {
    fields.push('expires_at = ?');
    values.push(updates.expiresAt);
  }

  if ('label' in updates) {
    fields.push('label = ?');
    values.push(updates.label);
  }

  if (fields.length === 0) {
    return getShareById(shareId);
  }

  fields.push('updated_at = ?');
  values.push(nowIso());
  values.push(shareId);

  db.prepare(`UPDATE shares SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  // Update user permissions if provided and sharing type is 'users'
  if ('userIds' in updates && Array.isArray(updates.userIds)) {
    const sharingType = updates.sharingType || existing.sharing_type;

    if (sharingType === 'users') {
      // Remove all existing permissions
      db.prepare('DELETE FROM share_permissions WHERE share_id = ?').run(shareId);

      // Add new permissions
      const insertPerm = db.prepare(`
        INSERT INTO share_permissions (id, share_id, user_id, created_at)
        VALUES (?, ?, ?, ?)
      `);

      const now = nowIso();
      for (const userId of updates.userIds) {
        try {
          insertPerm.run(generateId(), shareId, userId, now);
        } catch (err) {
          if (!err.message.includes('UNIQUE')) {
            throw err;
          }
        }
      }
    }
  }

  return getShareById(shareId);
};

/**
 * Delete share
 */
const deleteShare = async (shareId) => {
  const db = await getDb();
  const result = db.prepare('DELETE FROM shares WHERE id = ?').run(shareId);
  return result.changes > 0;
};

/**
 * Verify share password
 */
const verifySharePassword = async (shareId, password) => {
  const db = await getDb();
  const row = db.prepare('SELECT password_hash FROM shares WHERE id = ?').get(shareId);

  if (!row) {
    return false;
  }

  if (!row.password_hash) {
    // No password set
    return true;
  }

  if (!password) {
    return false;
  }

  return bcrypt.compareSync(password, row.password_hash);
};

/**
 * Check if a user has permission to access a share
 */
const hasUserPermission = async (shareId, userId) => {
  const db = await getDb();
  const share = db.prepare('SELECT sharing_type, owner_id FROM shares WHERE id = ?').get(shareId);

  if (!share) {
    return false;
  }

  // Owner always has permission
  if (share.owner_id === userId) {
    return true;
  }

  // Anyone shares don't need user check
  if (share.sharing_type === 'anyone') {
    return true;
  }

  // Check user-specific permission
  const perm = db.prepare(`
    SELECT id FROM share_permissions WHERE share_id = ? AND user_id = ?
  `).get(shareId, userId);

  return Boolean(perm);
};

/**
 * Check if a share is expired
 */
const isShareExpired = (share) => {
  if (!share || !share.expiresAt) {
    return false;
  }

  const expiryDate = new Date(share.expiresAt);
  return expiryDate < new Date();
};

/**
 * Update share access tracking
 */
const trackShareAccess = async (shareId) => {
  const db = await getDb();
  db.prepare(`
    UPDATE shares
    SET last_accessed_at = ?, download_count = download_count + 1
    WHERE id = ?
  `).run(nowIso(), shareId);
};

/**
 * Get share statistics for owner
 */
const getShareStats = async (shareId) => {
  const db = await getDb();
  const share = db.prepare('SELECT * FROM shares WHERE id = ?').get(shareId);
  if (!share) return null;

  // Count guest sessions
  const guestSessions = db.prepare(`
    SELECT COUNT(*) as count FROM guest_sessions WHERE share_id = ?
  `).get(shareId);

  return {
    downloadCount: share.download_count || 0,
    lastAccessedAt: share.last_accessed_at || null,
    guestSessionCount: guestSessions?.count || 0,
  };
};

/**
 * Clean up expired shares
 */
const cleanupExpiredShares = async () => {
  const db = await getDb();
  const result = db.prepare(`
    DELETE FROM shares WHERE expires_at IS NOT NULL AND expires_at < ?
  `).run(nowIso());

  return result.changes;
};

module.exports = {
  createShare,
  getShareById,
  getShareByToken,
  getSharesByOwnerId,
  getSharesForUser,
  updateShare,
  deleteShare,
  verifySharePassword,
  hasUserPermission,
  isShareExpired,
  trackShareAccess,
  getShareStats,
  cleanupExpiredShares,
};

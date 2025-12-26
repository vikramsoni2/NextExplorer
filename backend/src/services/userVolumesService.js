const crypto = require('crypto');
const path = require('path');
const fs = require('fs/promises');

const { getDb } = require('./db');

const generateId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}`;

const nowIso = () => new Date().toISOString();

/**
 * Transform database row to client-friendly object
 */
const toClientVolume = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    path: row.path,
    accessMode: row.access_mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

/**
 * Get all volumes assigned to a user
 */
const getVolumesForUser = async (userId) => {
  const db = await getDb();
  const rows = db
    .prepare('SELECT * FROM user_volumes WHERE user_id = ? ORDER BY label ASC')
    .all(userId);
  return rows.map(toClientVolume);
};

/**
 * Get a specific user volume by ID
 */
const getVolumeById = async (volumeId) => {
  const db = await getDb();
  const row = db
    .prepare('SELECT * FROM user_volumes WHERE id = ?')
    .get(volumeId);
  return toClientVolume(row);
};

/**
 * Get user volume by user ID and path
 */
const getVolumeByUserAndPath = async (userId, volumePath) => {
  const db = await getDb();
  const row = db
    .prepare('SELECT * FROM user_volumes WHERE user_id = ? AND path = ?')
    .get(userId, volumePath);
  return toClientVolume(row);
};

/**
 * Check if user has access to a given path (for volume access checks)
 * Returns the volume info if user has access, null otherwise
 */
const getUserVolumeForPath = async (userId, relativePath) => {
  const db = await getDb();
  const volumes = db
    .prepare('SELECT * FROM user_volumes WHERE user_id = ?')
    .all(userId);

  // Normalize the relative path
  const normalizedPath = relativePath.replace(/^\/+/, '').replace(/\/+$/, '');
  const pathParts = normalizedPath.split('/').filter(Boolean);

  if (pathParts.length === 0) {
    return null;
  }

  // The first segment should match a volume's path or label
  const firstSegment = pathParts[0];

  for (const vol of volumes) {
    // Check if the first segment matches the volume label (which is how it appears in the UI)
    if (vol.label === firstSegment) {
      return toClientVolume(vol);
    }
  }

  return null;
};

/**
 * Add a volume to a user
 */
const addVolumeToUser = async ({
  userId,
  label,
  volumePath,
  accessMode = 'readwrite',
}) => {
  const db = await getDb();

  // Validate inputs
  if (!userId) {
    const e = new Error('User ID is required');
    e.status = 400;
    throw e;
  }

  if (!label || typeof label !== 'string' || !label.trim()) {
    const e = new Error('Label is required');
    e.status = 400;
    throw e;
  }

  if (!volumePath || typeof volumePath !== 'string' || !volumePath.trim()) {
    const e = new Error('Path is required');
    e.status = 400;
    throw e;
  }

  // Validate access mode
  const validModes = ['readonly', 'readwrite'];
  if (!validModes.includes(accessMode)) {
    const e = new Error('Access mode must be "readonly" or "readwrite"');
    e.status = 400;
    throw e;
  }

  // Normalize path
  const normalizedPath = path.resolve(volumePath);

  // Verify the path exists and is a directory
  try {
    const stats = await fs.stat(normalizedPath);
    if (!stats.isDirectory()) {
      const e = new Error('Path must be a directory');
      e.status = 400;
      throw e;
    }
  } catch (err) {
    if (err.status) throw err;
    const e = new Error('Path does not exist or is not accessible');
    e.status = 400;
    throw e;
  }

  // Check for duplicate path for this user
  const existing = db
    .prepare('SELECT id FROM user_volumes WHERE user_id = ? AND path = ?')
    .get(userId, normalizedPath);

  if (existing) {
    const e = new Error('This path is already assigned to this user');
    e.status = 409;
    throw e;
  }

  // Check for duplicate label for this user
  const existingLabel = db
    .prepare('SELECT id FROM user_volumes WHERE user_id = ? AND label = ?')
    .get(userId, label.trim());

  if (existingLabel) {
    const e = new Error(
      'A volume with this label already exists for this user',
    );
    e.status = 409;
    throw e;
  }

  const id = generateId();
  const now = nowIso();

  db.prepare(
    `
    INSERT INTO user_volumes (id, user_id, label, path, access_mode, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(id, userId, label.trim(), normalizedPath, accessMode, now, now);

  return toClientVolume(
    db.prepare('SELECT * FROM user_volumes WHERE id = ?').get(id),
  );
};

/**
 * Update a user volume
 */
const updateUserVolume = async (volumeId, { label, accessMode }) => {
  const db = await getDb();

  const existing = db
    .prepare('SELECT * FROM user_volumes WHERE id = ?')
    .get(volumeId);
  if (!existing) {
    const e = new Error('Volume not found');
    e.status = 404;
    throw e;
  }

  const updates = [];
  const values = [];

  if (label !== undefined) {
    if (!label || typeof label !== 'string' || !label.trim()) {
      const e = new Error('Label cannot be empty');
      e.status = 400;
      throw e;
    }

    // Check for duplicate label for this user
    const duplicateLabel = db
      .prepare(
        'SELECT id FROM user_volumes WHERE user_id = ? AND label = ? AND id != ?',
      )
      .get(existing.user_id, label.trim(), volumeId);

    if (duplicateLabel) {
      const e = new Error(
        'A volume with this label already exists for this user',
      );
      e.status = 409;
      throw e;
    }

    updates.push('label = ?');
    values.push(label.trim());
  }

  if (accessMode !== undefined) {
    const validModes = ['readonly', 'readwrite'];
    if (!validModes.includes(accessMode)) {
      const e = new Error('Access mode must be "readonly" or "readwrite"');
      e.status = 400;
      throw e;
    }
    updates.push('access_mode = ?');
    values.push(accessMode);
  }

  if (updates.length === 0) {
    return toClientVolume(existing);
  }

  updates.push('updated_at = ?');
  values.push(nowIso());
  values.push(volumeId);

  db.prepare(`UPDATE user_volumes SET ${updates.join(', ')} WHERE id = ?`).run(
    ...values,
  );

  return toClientVolume(
    db.prepare('SELECT * FROM user_volumes WHERE id = ?').get(volumeId),
  );
};

/**
 * Remove a volume from a user
 */
const removeVolumeFromUser = async (volumeId) => {
  const db = await getDb();

  const existing = db
    .prepare('SELECT * FROM user_volumes WHERE id = ?')
    .get(volumeId);
  if (!existing) {
    const e = new Error('Volume not found');
    e.status = 404;
    throw e;
  }

  db.prepare('DELETE FROM user_volumes WHERE id = ?').run(volumeId);
  return true;
};

/**
 * Remove all volumes for a user (called when user is deleted, though CASCADE handles this)
 */
const removeAllVolumesForUser = async (userId) => {
  const db = await getDb();
  db.prepare('DELETE FROM user_volumes WHERE user_id = ?').run(userId);
  return true;
};

/**
 * Check if a user has access to a specific volume path
 */
const userHasVolumeAccess = async (userId, volumePath) => {
  const volume = await getUserVolumeForPath(userId, volumePath);
  return volume !== null;
};

/**
 * Get the base path for a volume (the path segment that matches the volume)
 * Used for resolving logical paths to actual filesystem paths
 */
const resolveUserVolumePath = async (userId, logicalPath) => {
  const db = await getDb();
  const volumes = db
    .prepare('SELECT * FROM user_volumes WHERE user_id = ?')
    .all(userId);

  // Normalize the logical path
  const normalizedPath = logicalPath.replace(/^\/+/, '').replace(/\/+$/, '');
  const pathParts = normalizedPath.split('/').filter(Boolean);

  if (pathParts.length === 0) {
    return null;
  }

  const firstSegment = pathParts[0];

  for (const vol of volumes) {
    if (vol.label === firstSegment) {
      // Found matching volume - construct the absolute path
      const remainingPath = pathParts.slice(1).join('/');
      const absolutePath = remainingPath
        ? path.join(vol.path, remainingPath)
        : vol.path;

      return {
        volume: toClientVolume(vol),
        absolutePath,
        relativePath: logicalPath,
      };
    }
  }

  return null;
};

module.exports = {
  getVolumesForUser,
  getVolumeById,
  getVolumeByUserAndPath,
  getUserVolumeForPath,
  addVolumeToUser,
  updateUserVolume,
  removeVolumeFromUser,
  removeAllVolumesForUser,
  userHasVolumeAccess,
  resolveUserVolumePath,
};

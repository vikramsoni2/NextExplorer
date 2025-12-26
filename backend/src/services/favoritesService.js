const fs = require('fs/promises');
const crypto = require('crypto');
const { getDb } = require('./db');
const { normalizeRelativePath } = require('../utils/pathUtils');
const { resolvePathWithAccess } = require('./accessManager');
const config = require('../config');

const DEFAULT_FAVORITE_ICON = config.favorites.defaultIcon;

const generateId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}`;

/**
 * Validate and sanitize a favorite
 */
const sanitize = (favorite) => {
  if (!favorite?.path) return null;

  try {
    const path = normalizeRelativePath(favorite.path);
    if (!path) return null;

    return {
      path,
      label: favorite.label?.trim() || null,
      icon: favorite.icon?.trim() || DEFAULT_FAVORITE_ICON,
      color: favorite.color?.trim() || null,
    };
  } catch {
    return null;
  }
};

/**
 * Map a database favorite row to API shape
 */
const mapDbFavorite = (row) => ({
  id: row.id,
  path: row.path,
  label: row.label,
  icon: row.icon,
  color: row.color || null,
  position: row.position ?? 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Ensure a user id is present
 */
const ensureUserId = (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  return userId;
};

/**
 * Get the next position for a user's favorites
 */
const getNextFavoritePosition = (db, userId) => {
  const row = db
    .prepare(
      `
    SELECT COALESCE(MAX(position), -1) AS maxPos
    FROM favorites
    WHERE user_id = ?
  `,
    )
    .get(userId);

  const currentMax = typeof row?.maxPos === 'number' ? row.maxPos : -1;
  return currentMax + 1;
};

/**
 * Ensure path exists and is a directory
 */
const validatePath = async (relativePath, user) => {
  const ctxUser = user && typeof user === 'object' ? user : null;
  if (!ctxUser || !ctxUser.id) {
    const err = new Error('User context is required');
    err.status = 400;
    throw err;
  }

  const { accessInfo, resolved } = await resolvePathWithAccess(
    { user: ctxUser, guestSession: null },
    relativePath,
  );
  if (!accessInfo?.canAccess || !resolved) {
    const err = new Error(accessInfo?.denialReason || 'Path is not accessible');
    err.status = 403;
    throw err;
  }

  const stats = await fs.stat(resolved.absolutePath);

  if (!stats.isDirectory()) {
    const err = new Error('Path must be a directory');
    err.status = 400;
    throw err;
  }
};

/**
 * Get all favorites for a user
 */
const getFavorites = async (userId) => {
  ensureUserId(userId);

  const db = await getDb();
  const favorites = db
    .prepare(
      `
    SELECT id, path, label, icon, color, created_at, updated_at, position
    FROM favorites
    WHERE user_id = ?
    ORDER BY position ASC, created_at ASC
  `,
    )
    .all(userId);

  return favorites.map(mapDbFavorite);
};

/**
 * Add or update a favorite for a user
 */
const addFavorite = async (userOrId, { path, label, icon, color }) => {
  const user =
    userOrId && typeof userOrId === 'object' ? userOrId : { id: userOrId };
  const userId = ensureUserId(user?.id);

  const favorite = sanitize({ path, label, icon, color });
  if (!favorite) {
    const err = new Error('Invalid path');
    err.status = 400;
    throw err;
  }

  await validatePath(favorite.path, user);

  const db = await getDb();
  const now = new Date().toISOString();
  const id = generateId();
  const position = getNextFavoritePosition(db, userId);

  db.prepare(
    `
    INSERT INTO favorites (id, user_id, path, label, icon, color, created_at, updated_at, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, path) DO UPDATE SET
      label = excluded.label,
      icon = excluded.icon,
      color = excluded.color,
      updated_at = excluded.updated_at
  `,
  ).run(
    id,
    userId,
    favorite.path,
    favorite.label,
    favorite.icon,
    favorite.color,
    now,
    now,
    position,
  );

  const row = db
    .prepare(
      `
    SELECT id, path, label, icon, color, created_at, updated_at, position
    FROM favorites
    WHERE user_id = ? AND path = ?
  `,
    )
    .get(userId, favorite.path);

  return mapDbFavorite(row);
};

/**
 * Remove a favorite for a user
 */
const removeFavorite = async (userId, path) => {
  ensureUserId(userId);

  const normalizedPath = normalizeRelativePath(path);

  const db = await getDb();
  db.prepare(
    `
    DELETE FROM favorites WHERE user_id = ? AND path = ?
  `,
  ).run(userId, normalizedPath);

  // Return updated list
  return getFavorites(userId);
};

/**
 * Update a favorite's label or icon
 */
const updateFavorite = async (userId, favoriteId, updates) => {
  ensureUserId(userId);

  const db = await getDb();
  const now = new Date().toISOString();

  const fields = [];
  const values = [];

  if (updates.label !== undefined) {
    fields.push('label = ?');
    values.push(updates.label?.trim() || null);
  }

  if (updates.icon !== undefined) {
    fields.push('icon = ?');
    values.push(updates.icon?.trim() || DEFAULT_FAVORITE_ICON);
  }

  if (updates.color !== undefined) {
    fields.push('color = ?');
    values.push(updates.color?.trim() || null);
  }

  if (updates.position !== undefined) {
    fields.push('position = ?');
    const numericPosition = Number(updates.position);
    values.push(Number.isFinite(numericPosition) ? numericPosition : 0);
  }

  if (fields.length === 0) {
    const err = new Error('No fields to update');
    err.status = 400;
    throw err;
  }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(favoriteId);
  values.push(userId);

  const result = db
    .prepare(
      `
    UPDATE favorites
    SET ${fields.join(', ')}
    WHERE id = ? AND user_id = ?
  `,
    )
    .run(...values);

  if (result.changes === 0) {
    const err = new Error('Favorite not found');
    err.status = 404;
    throw err;
  }

  const updated = db
    .prepare(
      `
    SELECT id, path, label, icon, color, created_at, updated_at, position
    FROM favorites
    WHERE id = ? AND user_id = ?
  `,
    )
    .get(favoriteId, userId);

  return mapDbFavorite(updated);
};

/**
 * Reorder favorites for a user
 * Expects an array of favorite IDs in the desired order.
 */
const reorderFavorites = async (userId, orderedIds) => {
  ensureUserId(userId);

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    const err = new Error('Order must be a non-empty array');
    err.status = 400;
    throw err;
  }

  const db = await getDb();

  const existing = db
    .prepare(
      `
    SELECT id
    FROM favorites
    WHERE user_id = ?
  `,
    )
    .all(userId);

  const existingIds = existing.map((row) => row.id);

  if (existingIds.length !== orderedIds.length) {
    const err = new Error('Order must include all favorites');
    err.status = 400;
    throw err;
  }

  const existingSet = new Set(existingIds);
  const uniqueOrderedIds = new Set();

  for (const id of orderedIds) {
    if (typeof id !== 'string' || !id) {
      const err = new Error('Order must contain valid favorite IDs');
      err.status = 400;
      throw err;
    }
    if (!existingSet.has(id)) {
      const err = new Error('Order contains unknown favorite ID');
      err.status = 400;
      throw err;
    }
    uniqueOrderedIds.add(id);
  }

  if (uniqueOrderedIds.size !== orderedIds.length) {
    const err = new Error('Order must not contain duplicate IDs');
    err.status = 400;
    throw err;
  }

  const updatePosition = db.prepare(`
    UPDATE favorites
    SET position = ?
    WHERE user_id = ? AND id = ?
  `);

  const transact = db.transaction((ids) => {
    ids.forEach((id, index) => {
      updatePosition.run(index, userId, id);
    });
  });

  transact(orderedIds);

  const rows = db
    .prepare(
      `
    SELECT id, path, label, icon, color, created_at, updated_at, position
    FROM favorites
    WHERE user_id = ?
    ORDER BY position ASC, created_at ASC
  `,
    )
    .all(userId);

  return rows.map(mapDbFavorite);
};

module.exports = {
  getFavorites,
  addFavorite,
  removeFavorite,
  updateFavorite,
  reorderFavorites,
};

const crypto = require('crypto');
const { getDb } = require('./db');

const nowIso = () => new Date().toISOString();

const generateId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}`;

// Default session duration: 24 hours
const DEFAULT_SESSION_HOURS = 24;

/**
 * Convert database row to client-safe session object
 */
const toClientSession = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    shareId: row.share_id,
    ipAddress: row.ip_address || null,
    userAgent: row.user_agent || null,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastActivityAt: row.last_activity_at,
  };
};

/**
 * Create a new guest session
 */
const createGuestSession = async ({
  shareId,
  ipAddress = null,
  userAgent = null,
  durationHours = DEFAULT_SESSION_HOURS,
}) => {
  if (!shareId) {
    const e = new Error('Share ID is required');
    e.status = 400;
    throw e;
  }

  const db = await getDb();
  const sessionId = generateId();
  const now = nowIso();
  const expiresAt = new Date(
    Date.now() + durationHours * 60 * 60 * 1000,
  ).toISOString();

  db.prepare(
    `
    INSERT INTO guest_sessions (
      id, share_id, ip_address, user_agent, created_at, expires_at, last_activity_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(sessionId, shareId, ipAddress, userAgent, now, expiresAt, now);

  return getGuestSession(sessionId);
};

/**
 * Get guest session by ID
 */
const getGuestSession = async (sessionId) => {
  const db = await getDb();
  const row = db
    .prepare('SELECT * FROM guest_sessions WHERE id = ?')
    .get(sessionId);
  return toClientSession(row);
};

/**
 * Get all guest sessions for a share
 */
const getGuestSessionsByShareId = async (shareId) => {
  const db = await getDb();
  const rows = db
    .prepare(
      `
    SELECT * FROM guest_sessions
    WHERE share_id = ?
    ORDER BY created_at DESC
  `,
    )
    .all(shareId);

  return rows.map(toClientSession);
};

/**
 * Check if a guest session is valid (exists and not expired)
 */
const isGuestSessionValid = async (sessionId) => {
  const session = await getGuestSession(sessionId);

  if (!session) {
    return false;
  }

  const now = new Date();
  const expiresAt = new Date(session.expiresAt);

  return now < expiresAt;
};

/**
 * Update guest session activity (refresh last activity timestamp)
 */
const updateGuestSessionActivity = async (sessionId) => {
  const db = await getDb();
  const result = db
    .prepare(
      `
    UPDATE guest_sessions
    SET last_activity_at = ?
    WHERE id = ?
  `,
    )
    .run(nowIso(), sessionId);

  return result.changes > 0;
};

/**
 * Delete guest session
 */
const deleteGuestSession = async (sessionId) => {
  const db = await getDb();
  const result = db
    .prepare('DELETE FROM guest_sessions WHERE id = ?')
    .run(sessionId);
  return result.changes > 0;
};

/**
 * Delete all guest sessions for a share
 */
const deleteGuestSessionsByShareId = async (shareId) => {
  const db = await getDb();
  const result = db
    .prepare('DELETE FROM guest_sessions WHERE share_id = ?')
    .run(shareId);
  return result.changes;
};

/**
 * Clean up expired guest sessions
 */
const cleanupExpiredSessions = async () => {
  const db = await getDb();
  const result = db
    .prepare(
      `
    DELETE FROM guest_sessions WHERE expires_at < ?
  `,
    )
    .run(nowIso());

  return result.changes;
};

/**
 * Get guest session count for a share
 */
const getActiveSessionCount = async (shareId) => {
  const db = await getDb();
  const row = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM guest_sessions
    WHERE share_id = ? AND expires_at > ?
  `,
    )
    .get(shareId, nowIso());

  return row?.count || 0;
};

/**
 * Extend guest session expiration
 */
const extendGuestSession = async (
  sessionId,
  additionalHours = DEFAULT_SESSION_HOURS,
) => {
  const session = await getGuestSession(sessionId);

  if (!session) {
    const e = new Error('Guest session not found');
    e.status = 404;
    throw e;
  }

  const currentExpiry = new Date(session.expiresAt);
  const newExpiry = new Date(
    currentExpiry.getTime() + additionalHours * 60 * 60 * 1000,
  );

  const db = await getDb();
  db.prepare(
    `
    UPDATE guest_sessions
    SET expires_at = ?, last_activity_at = ?
    WHERE id = ?
  `,
  ).run(newExpiry.toISOString(), nowIso(), sessionId);

  return getGuestSession(sessionId);
};

/**
 * Verify guest session belongs to a specific share
 */
const verifyGuestSessionShare = async (sessionId, shareId) => {
  const session = await getGuestSession(sessionId);

  if (!session) {
    return false;
  }

  return session.shareId === shareId;
};

module.exports = {
  createGuestSession,
  getGuestSession,
  getGuestSessionsByShareId,
  isGuestSessionValid,
  updateGuestSessionActivity,
  deleteGuestSession,
  deleteGuestSessionsByShareId,
  cleanupExpiredSessions,
  getActiveSessionCount,
  extendGuestSession,
  verifyGuestSessionShare,
};

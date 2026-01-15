/**
 * User Search Service for Collabora @ mentions
 *
 * Searches local SQLite database for users who have logged in.
 *
 * Note: OIDC/OAuth2 does not define a standard user search API.
 * Users must log in at least once to appear in @ mention suggestions.
 */

const { getDb } = require('./db');
const logger = require('../utils/logger');

/**
 * Search users in local SQLite database
 * @param {string} query - Search term
 * @param {number} limit - Max results
 * @returns {Promise<Array<{UserId: string, UserFriendlyName: string, UserEmail: string}>>}
 */
const searchLocalUsers = async (query, limit = 10) => {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }

  try {
    const db = await getDb();
    const searchPattern = `%${query}%`;

    const rows = db
      .prepare(
        `
      SELECT id, email, username, display_name
      FROM users
      WHERE 
        display_name LIKE ? COLLATE NOCASE OR
        email LIKE ? COLLATE NOCASE OR
        username LIKE ? COLLATE NOCASE
      ORDER BY 
        CASE 
          WHEN display_name LIKE ? COLLATE NOCASE THEN 0
          WHEN username LIKE ? COLLATE NOCASE THEN 1
          ELSE 2
        END,
        display_name ASC,
        email ASC
      LIMIT ?
    `
      )
      .all(searchPattern, searchPattern, searchPattern, `${query}%`, `${query}%`, limit);

    return rows.map((row) => ({
      UserId: row.id,
      UserFriendlyName: row.display_name || row.username || row.email || 'Unknown',
      UserEmail: row.email || '',
    }));
  } catch (err) {
    logger.error({ err }, '[UserSearch] Error searching local users');
    return [];
  }
};

/**
 * Search users for Collabora @ mentions
 *
 * Searches the local database for users who have logged in at least once.
 *
 * @param {string} query - Search term (partial name/email)
 * @param {number} limit - Max results to return
 * @returns {Promise<{Users: Array<{UserId: string, UserFriendlyName: string, UserEmail: string}>}>}
 */
const searchUsersForMentions = async (query, limit = 10) => {
  if (!query || typeof query !== 'string' || query.trim().length < 1) {
    return { Users: [] };
  }

  const trimmedQuery = query.trim();
  const users = await searchLocalUsers(trimmedQuery, limit);

  logger.debug(`[UserSearch] Query="${trimmedQuery}" found ${users.length} users`);

  return { Users: users };
};

module.exports = {
  searchUsersForMentions,
  searchLocalUsers,
};

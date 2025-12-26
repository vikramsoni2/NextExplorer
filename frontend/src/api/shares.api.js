import { requestJson, normalizePath, encodePath } from './http';

/**
 * Create a new share
 */
async function createShare({
  sourcePath,
  accessMode = 'readonly',
  sharingType = 'anyone',
  password = null,
  userIds = [],
  expiresAt = null,
  label = null,
}) {
  const normalizedPath = normalizePath(sourcePath);

  return requestJson('/api/shares', {
    method: 'POST',
    body: JSON.stringify({
      sourcePath: normalizedPath,
      accessMode,
      sharingType,
      password,
      userIds,
      expiresAt,
      label,
    }),
  });
}

/**
 * Get all shares created by current user
 */
async function getMyShares() {
  return requestJson('/api/shares', { method: 'GET' });
}

/**
 * Get shares shared with current user
 */
async function getSharedWithMe() {
  return requestJson('/api/shares/shared-with-me', { method: 'GET' });
}

/**
 * Get share details by ID
 */
async function getShareById(shareId) {
  return requestJson(`/api/shares/${shareId}`, { method: 'GET' });
}

/**
 * Update an existing share
 */
async function updateShare(shareId, updates) {
  return requestJson(`/api/shares/${shareId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

/**
 * Delete a share
 */
async function deleteShare(shareId) {
  return requestJson(`/api/shares/${shareId}`, {
    method: 'DELETE',
  });
}

/**
 * Get public share info (no auth required)
 */
async function getShareInfo(shareToken) {
  return requestJson(`/api/share/${shareToken}/info`, { method: 'GET' });
}

/**
 * Verify password for a password-protected share
 */
async function verifySharePassword(shareToken, password) {
  return requestJson(`/api/share/${shareToken}/verify`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

/**
 * Access a share (creates guest session if needed)
 */
async function accessShare(shareToken) {
  return requestJson(`/api/share/${shareToken}/access`, { method: 'GET' });
}

/**
 * Browse share contents
 */
async function browseShare(shareToken, innerPath = '') {
  const normalizedInnerPath = normalizePath(innerPath);
  const encodedPath = encodePath(normalizedInnerPath);
  const endpoint = encodedPath
    ? `/api/share/${shareToken}/browse/${encodedPath}`
    : `/api/share/${shareToken}/browse/`;

  return requestJson(endpoint, { method: 'GET' });
}

/**
 * Store guest session ID in sessionStorage
 */
function setGuestSession(sessionId) {
  if (sessionId) {
    sessionStorage.setItem('guestSessionId', sessionId);
  } else {
    sessionStorage.removeItem('guestSessionId');
  }
}

/**
 * Get guest session ID from sessionStorage
 */
function getGuestSession() {
  return sessionStorage.getItem('guestSessionId');
}

/**
 * Clear guest session
 */
function clearGuestSession() {
  sessionStorage.removeItem('guestSessionId');
}

/**
 * Generate share URL for a token
 */
function getShareUrl(shareToken) {
  const baseUrl = window.location.origin;
  return `${baseUrl}/share/${shareToken}`;
}

/**
 * Copy share URL to clipboard
 */
async function copyShareUrl(shareToken) {
  const url = getShareUrl(shareToken);

  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(url);
    return true;
  } else {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
}

export {
  createShare,
  getMyShares,
  getSharedWithMe,
  getShareById,
  updateShare,
  deleteShare,
  getShareInfo,
  verifySharePassword,
  accessShare,
  browseShare,
  setGuestSession,
  getGuestSession,
  clearGuestSession,
  getShareUrl,
  copyShareUrl,
};

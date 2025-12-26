// /api/users.api.js

import { requestJson } from './http';

export async function fetchUsers() {
  return requestJson('/api/users', { method: 'GET' });
}

export async function fetchShareableUsers() {
  return requestJson('/api/users/shareable', { method: 'GET' });
}

export async function updateUserRoles(userId, roles) {
  return requestJson(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ roles: Array.isArray(roles) ? roles : [] }),
  });
}

export async function updateUser(userId, data) {
  return requestJson(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(data || {}),
  });
}

export async function createUser({
  email,
  username,
  password,
  displayName,
  roles = [],
}) {
  return requestJson('/api/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      username,
      password,
      displayName,
      roles: Array.isArray(roles) ? roles : [],
    }),
  });
}

export async function adminSetUserPassword(userId, newPassword) {
  return requestJson(`/api/users/${encodeURIComponent(userId)}/password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  });
}

export async function deleteUser(userId) {
  return requestJson(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

// User Volumes API (admin only, requires USER_VOLUMES feature)

export async function fetchUserVolumes(userId) {
  return requestJson(`/api/users/${encodeURIComponent(userId)}/volumes`, {
    method: 'GET',
  });
}

export async function addUserVolume(
  userId,
  { label, path, accessMode = 'readwrite' },
) {
  return requestJson(`/api/users/${encodeURIComponent(userId)}/volumes`, {
    method: 'POST',
    body: JSON.stringify({ label, path, accessMode }),
  });
}

export async function updateUserVolume(
  userId,
  volumeId,
  { label, accessMode },
) {
  return requestJson(
    `/api/users/${encodeURIComponent(userId)}/volumes/${encodeURIComponent(volumeId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ label, accessMode }),
    },
  );
}

export async function removeUserVolume(userId, volumeId) {
  return requestJson(
    `/api/users/${encodeURIComponent(userId)}/volumes/${encodeURIComponent(volumeId)}`,
    {
      method: 'DELETE',
    },
  );
}

export async function browseAdminDirectories(dirPath = '') {
  const params = dirPath ? `?path=${encodeURIComponent(dirPath)}` : '';
  return requestJson(`/api/admin/browse-directories${params}`, {
    method: 'GET',
  });
}

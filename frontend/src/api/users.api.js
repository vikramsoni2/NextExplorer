// /api/users.api.js

import { requestJson, encodePath } from './http';

export async function fetchUsers() {
  return requestJson('/api/users', { method: 'GET' });
}

export async function updateUserRoles(userId, roles) {
  return requestJson(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ roles: Array.isArray(roles) ? roles : [] }),
  });
}

export async function createUser({ email, username, password, displayName, roles = [] }) {
  return requestJson('/api/users', {
    method: 'POST',
    body: JSON.stringify({ email, username, password, displayName, roles: Array.isArray(roles) ? roles : [] }),
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
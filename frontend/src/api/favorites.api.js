// /api/favorites.api.js

import { requestJson, normalizePath } from './http';

async function fetchFavorites() {
  return requestJson('/api/favorites', { method: 'GET' });
}

async function addFavorite(path, { label, icon } = {}) {
  const normalizedPath = normalizePath(path || '');
  return requestJson('/api/favorites', {
    method: 'POST',
    body: JSON.stringify({
      path: normalizedPath,
      label,
      icon,
    }),
  });
}

async function updateFavorite(id, { label, icon, position } = {}) {
  return requestJson(`/api/favorites/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      label,
      icon,
      position,
    }),
  });
}

async function reorderFavorites(order) {
  return requestJson('/api/favorites/reorder', {
    method: 'PATCH',
    body: JSON.stringify({
      order,
    }),
  });
}

async function removeFavorite(path) {
  const normalizedPath = normalizePath(path || '');
  return requestJson('/api/favorites', {
    method: 'DELETE',
    body: JSON.stringify({
      path: normalizedPath,
    }),
  });
}

export {
  fetchFavorites,
  addFavorite,
  updateFavorite,
  reorderFavorites,
  removeFavorite,
}

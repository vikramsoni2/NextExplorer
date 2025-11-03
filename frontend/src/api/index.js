const DEFAULT_API_BASE = '/';
const apiBase = (import.meta.env.VITE_API_URL || DEFAULT_API_BASE).replace(/\/$/, '');

const encodePath = (relativePath = '') => {
  if (!relativePath) return '';
  return relativePath
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
};

const normalizePath = (relativePath = '') => {
  if (!relativePath) {
    return '';
  }

  const trimmed = relativePath.replace(/^\/+|\/+$/g, '');
  return trimmed;
};

const buildUrl = (endpoint) => `${apiBase}${endpoint}`;

// All requests rely on cookie-based session (credentials: 'include')

const requestJson = async (endpoint, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const headers = {
    ...(options.headers || {}),
  };

  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const response = await fetch(buildUrl(endpoint), {
    credentials: options.credentials || 'include',
    ...options,
    method,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData?.error) {
        errorMessage = errorData.error;
      }
    } catch (error) {
      // Ignore JSON parsing errors and fall back to default error message
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

async function browse(path = '') {
  const normalizedPath = normalizePath(path);
  const encodedPath = encodePath(normalizedPath);
  const endpoint = encodedPath ? `/api/browse/${encodedPath}` : '/api/browse/';
  return requestJson(endpoint, { method: 'GET' });
}

async function getVolumes() {
  return requestJson('/api/volumes', { method: 'GET' });
}

async function copyItems(items, destination) {
  return requestJson('/api/files/copy', {
    method: 'POST',
    body: JSON.stringify({ items, destination }),
  });
}

async function moveItems(items, destination) {
  return requestJson('/api/files/move', {
    method: 'POST',
    body: JSON.stringify({ items, destination }),
  });
}

async function deleteItems(items) {
  return requestJson('/api/files', {
    method: 'DELETE',
    body: JSON.stringify({ items }),
  });
}

async function createFolder(destination, name) {
  const normalizedDestination = normalizePath(destination || '');
  const payload = { path: normalizedDestination };

  if (typeof name === 'string' && name.trim()) {
    payload.name = name;
  }

  return requestJson('/api/files/folder', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function renameItem(path, name, newName) {
  const normalizedPath = normalizePath(path || '');
  return requestJson('/api/files/rename', {
    method: 'POST',
    body: JSON.stringify({
      path: normalizedPath,
      name,
      newName,
    }),
  });
}

async function fetchFavorites() {
  return requestJson('/api/favorites', { method: 'GET' });
}

async function addFavorite(path, icon) {
  const normalizedPath = normalizePath(path || '');
  return requestJson('/api/favorites', {
    method: 'POST',
    body: JSON.stringify({
      path: normalizedPath,
      icon,
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

async function fetchFileContent(path) {
  return requestJson('/api/editor', {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
}

async function saveFileContent(path, content) {
  return requestJson('/api/editor', {
    method: 'PUT',
    body: JSON.stringify({ path, content }),
  });
}

async function fetchThumbnail(relativePath) {
  const normalizedPath = normalizePath(relativePath);
  if (!normalizedPath) {
    throw new Error('A file path is required to fetch a thumbnail.');
  }

  const encodedPath = encodePath(normalizedPath);
  return requestJson(`/api/thumbnails/${encodedPath}`, { method: 'GET' });
}

const downloadItems = async (paths, basePath = '') => {
  const normalizedList = (Array.isArray(paths) ? paths : [paths])
    .map((item) => normalizePath(item))
    .filter(Boolean);

  if (normalizedList.length === 0) {
    throw new Error('At least one path is required for download.');
  }

  const normalizedBase = normalizePath(basePath || '');

  const response = await fetch(buildUrl('/api/download'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      items: normalizedList,
      basePath: normalizedBase,
    }),
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData?.error) {
        errorMessage = errorData.error;
      }
    } catch (error) {
      // Ignore JSON parsing errors and fall back to default error message
    }
    throw new Error(errorMessage);
  }

  return response;
};

async function search(path = '', q = '', limit) {
  const normalizedPath = normalizePath(path || '');
  const params = new URLSearchParams();
  if (normalizedPath) params.set('path', normalizedPath);
  if (typeof q === 'string' && q.trim()) params.set('q', q.trim());
  if (Number.isFinite(limit) && limit > 0) params.set('limit', String(limit));
  const endpoint = `/api/search?${params.toString()}`;
  return requestJson(endpoint, { method: 'GET' });
}

const getPreviewUrl = (relativePath) => {
  const normalizedPath = normalizePath(relativePath);
  if (!normalizedPath) {
    return null;
  }

  const params = new URLSearchParams({ path: normalizedPath });
  const url = buildUrl(`/api/preview?${params.toString()}`);
  return url;
};

const fetchAuthStatus = () => requestJson('/api/auth/status', { method: 'GET' });

const setupAccount = ({ username, password }) => requestJson('/api/auth/setup', {
  method: 'POST',
  body: JSON.stringify({ username, password }),
});

const login = ({ username, password }) => requestJson('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ username, password }),
});

const fetchCurrentUser = () => requestJson('/api/auth/me', { method: 'GET' });

// Token minting removed: cookie-based session only

const logout = () => requestJson('/api/auth/logout', {
  method: 'POST',
});

export {
  apiBase,
  browse,
  getVolumes,
  copyItems,
  moveItems,
  deleteItems,
  createFolder,
  renameItem,
  fetchFileContent,
  saveFileContent,
  fetchThumbnail,
  fetchFavorites,
  addFavorite,
  removeFavorite,
  downloadItems,
  getPreviewUrl,
  normalizePath,
  encodePath,
  fetchAuthStatus,
  search,
  // settings
  // GET /api/settings
  // PATCH /api/settings
};

// Settings API (export after function declarations below)
async function getSettings() {
  return requestJson('/api/settings', { method: 'GET' });
}

async function patchSettings(partial) {
  return requestJson('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(partial || {}),
  });
}

export {
  getSettings,
  patchSettings,
  setupAccount,
  login,
  logout,
  fetchCurrentUser,
};

// Admin Users API
async function fetchUsers() {
  return requestJson('/api/users', { method: 'GET' });
}

async function updateUserRoles(userId, roles) {
  return requestJson(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ roles: Array.isArray(roles) ? roles : [] }),
  });
}

// Admin - create local user
async function createUser({ username, password, roles = [] }) {
  return requestJson('/api/users', {
    method: 'POST',
    body: JSON.stringify({ username, password, roles: Array.isArray(roles) ? roles : [] }),
  });
}

// Admin - set password for a user (local provider only)
async function adminSetUserPassword(userId, newPassword) {
  return requestJson(`/api/users/${encodeURIComponent(userId)}/password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  });
}

// Admin - delete a user (local provider only)
async function deleteUser(userId) {
  return requestJson(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

// Auth - change password (local users)
async function changePassword({ currentPassword, newPassword }) {
  return requestJson('/api/auth/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export {
  fetchUsers,
  updateUserRoles,
  createUser,
  adminSetUserPassword,
  deleteUser,
  changePassword,
};

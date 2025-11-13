import {
  requestJson,
  requestRaw,
  normalizePath,
  encodePath,
  buildUrl,
} from './http';

async function browse(path = '') {
  const normalizedPath = normalizePath(path);
  const encodedPath = encodePath(normalizedPath);
  const endpoint = encodedPath ? `/api/browse/${encodedPath}` : '/api/browse/';
  return requestJson(endpoint, { method: 'GET' });
}

async function getVolumes() {
  return requestJson('/api/volumes', { method: 'GET' });
}

async function getUsage(path = '') {
  const normalizedPath = normalizePath(path);
  const encodedPath = encodePath(normalizedPath);
  return requestJson(`/api/usage/${encodedPath}`, { method: 'GET' });
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

async function fetchMetadata(relativePath) {
  const normalizedPath = normalizePath(relativePath);
  if (!normalizedPath) {
    throw new Error('A file path is required to fetch metadata.');
  }
  const encodedPath = encodePath(normalizedPath);
  return requestJson(`/api/metadata/${encodedPath}`, { method: 'GET' });
}

async function downloadItems(paths, basePath = '') {
  const normalizedList = (Array.isArray(paths) ? paths : [paths])
    .map((item) => normalizePath(item))
    .filter(Boolean);

  if (normalizedList.length === 0) {
    throw new Error('At least one path is required for download.');
  }

  const normalizedBase = normalizePath(basePath || '');

  // Use requestRaw as this returns a file blob, not JSON
  return requestRaw('/api/download', {
    method: 'POST',
    body: JSON.stringify({
      items: normalizedList,
      basePath: normalizedBase,
    }),
  });
}

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
  return buildUrl(`/api/preview?${params.toString()}`);
};

export {
  browse,
  getVolumes,
  getUsage,
  copyItems,
  moveItems,
  deleteItems,
  createFolder,
  renameItem,
  fetchFileContent,
  saveFileContent,
  fetchThumbnail,
  fetchMetadata,
  downloadItems,
  search,
  getPreviewUrl
}

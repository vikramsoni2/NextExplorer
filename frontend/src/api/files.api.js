import { requestJson, requestRaw, normalizePath, encodePath, buildUrl } from './http';

const DELETE_BATCH_SIZE = 100;

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

async function getFolderSizesBatch(paths = [], options = {}) {
  const normalizedPaths = (Array.isArray(paths) ? paths : [])
    .map((p) => normalizePath(p))
    .filter(Boolean);
  return requestJson('/api/folder-size/batch', {
    ...options,
    method: 'POST',
    body: JSON.stringify({ paths: normalizedPaths }),
  });
}

async function refreshFolderSize(relativePath, options = {}) {
  const normalizedPath = normalizePath(relativePath);
  if (!normalizedPath) {
    throw new Error('A folder path is required to refresh its size.');
  }
  const encodedPath = encodePath(normalizedPath);
  return requestJson(`/api/folder-size/refresh/${encodedPath}`, { ...options, method: 'POST' });
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
  const normalizedItems = Array.isArray(items) ? items : [];
  if (normalizedItems.length <= DELETE_BATCH_SIZE) {
    return requestJson('/api/files', {
      method: 'DELETE',
      body: JSON.stringify({ items: normalizedItems }),
    });
  }

  const deletedItems = [];
  for (let index = 0; index < normalizedItems.length; index += DELETE_BATCH_SIZE) {
    const batch = normalizedItems.slice(index, index + DELETE_BATCH_SIZE);
    // eslint-disable-next-line no-await-in-loop
    const response = await requestJson('/api/files', {
      method: 'DELETE',
      body: JSON.stringify({ items: batch }),
    });
    deletedItems.push(...(Array.isArray(response?.items) ? response.items : []));
  }

  return { success: true, items: deletedItems };
}

async function getDeleteImpact(items) {
  const normalizedItems = Array.isArray(items) ? items : [];
  if (normalizedItems.length <= DELETE_BATCH_SIZE) {
    return requestJson('/api/files/delete-impact', {
      method: 'POST',
      body: JSON.stringify({ items: normalizedItems }),
    });
  }

  const sharesById = new Map();
  for (let index = 0; index < normalizedItems.length; index += DELETE_BATCH_SIZE) {
    const batch = normalizedItems.slice(index, index + DELETE_BATCH_SIZE);
    // eslint-disable-next-line no-await-in-loop
    const response = await requestJson('/api/files/delete-impact', {
      method: 'POST',
      body: JSON.stringify({ items: batch }),
    });
    const shares = Array.isArray(response?.shares) ? response.shares : [];
    shares.forEach((share) => {
      if (share?.id) sharesById.set(share.id, share);
    });
  }

  const shares = Array.from(sharesById.values());
  return {
    shareCount: shares.length,
    shares,
  };
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

function getRawFileUrl(path) {
  const normalizedPath = normalizePath(path);
  if (!normalizedPath) {
    throw new Error('A file path is required.');
  }

  const params = new URLSearchParams({ path: normalizedPath });
  return buildUrl(`/api/raw?${params.toString()}`);
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

async function extractZip(relativePath) {
  const normalizedPath = normalizePath(relativePath);
  if (!normalizedPath) {
    throw new Error('A zip file path is required.');
  }
  return requestJson('/api/files/zip/extract', {
    method: 'POST',
    body: JSON.stringify({ path: normalizedPath }),
  });
}

async function compressToZip(items, destination = '', name) {
  const payload = {
    items: Array.isArray(items) ? items : [],
    destination: normalizePath(destination || ''),
  };
  if (typeof name === 'string' && name.trim()) {
    payload.name = name.trim();
  }

  return requestJson('/api/files/zip/compress', {
    method: 'POST',
    body: JSON.stringify(payload),
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

async function fetchPermissions(relativePath) {
  const normalizedPath = normalizePath(relativePath);
  if (!normalizedPath) {
    throw new Error('A file path is required to fetch permissions.');
  }
  const encodedPath = encodePath(normalizedPath);
  return requestJson(`/api/permissions/${encodedPath}`, { method: 'GET' });
}

async function changePermissions(path, mode, recursive = false) {
  const normalizedPath = normalizePath(path);
  return requestJson('/api/permissions/chmod', {
    method: 'POST',
    body: JSON.stringify({
      path: normalizedPath,
      mode,
      recursive,
    }),
  });
}

async function changeOwnership(path, owner, group) {
  const normalizedPath = normalizePath(path);
  const payload = { path: normalizedPath };
  if (owner) payload.owner = owner;
  if (group) payload.group = group;

  return requestJson('/api/permissions/chown', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * The audio and subtitle tracks a media file carries.
 *
 * The player does not transcode, so a track it cannot decode simply produces
 * nothing — a film with an AC-3 soundtrack plays in silence, and until this
 * existed the interface had no way to say why. Returns null when the server
 * cannot read the file, which the caller treats as "say nothing" rather than
 * "there is nothing".
 */
async function fetchMediaTracks(relativePath) {
  const normalizedPath = normalizePath(relativePath);
  if (!normalizedPath) return null;

  const params = new URLSearchParams({ path: normalizedPath });
  try {
    return await requestJson(`/api/media/tracks?${params.toString()}`, { method: 'GET' });
  } catch (_) {
    // A file ffprobe will not read is not an error worth showing anyone; the
    // video still plays, and the extra information is simply unavailable.
    return null;
  }
}

/**
 * A URL for one subtitle track, converted to WebVTT.
 *
 * Handed straight to a `<track>` element rather than fetched, so the browser's
 * own caption menu drives it. That works because the API is served from the
 * same origin as the application; a `<track>` pointing somewhere else would
 * need CORS and would not carry the session cookie.
 *
 * @param {string} relativePath the media file
 * @param {{stream?: number, file?: string}} track as named by fetchMediaTracks:
 *   a stream index for an embedded track, a filename for a sidecar
 */
const getSubtitleUrl = (relativePath, track = {}) => {
  const normalizedPath = normalizePath(relativePath);
  if (!normalizedPath) return null;

  const params = new URLSearchParams({ path: normalizedPath });
  if (typeof track.file === 'string' && track.file) {
    params.set('file', track.file);
  } else if (Number.isInteger(track.stream)) {
    params.set('stream', String(track.stream));
  } else {
    return null;
  }

  return buildUrl(`/api/media/subtitle?${params.toString()}`);
};

export {
  browse,
  getVolumes,
  getUsage,
  getFolderSizesBatch,
  refreshFolderSize,
  copyItems,
  moveItems,
  deleteItems,
  getDeleteImpact,
  createFolder,
  renameItem,
  fetchFileContent,
  saveFileContent,
  getRawFileUrl,
  fetchThumbnail,
  fetchMetadata,
  fetchMediaTracks,
  getSubtitleUrl,
  downloadItems,
  extractZip,
  compressToZip,
  search,
  getPreviewUrl,
  fetchPermissions,
  changePermissions,
  changeOwnership,
};

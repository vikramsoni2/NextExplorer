const DEFAULT_API_BASE = 'http://localhost:3000';
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

const requestJson = async (endpoint, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const headers = {
    ...(options.headers || {}),
  };

  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const response = await fetch(buildUrl(endpoint), {
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
    headers: {
      'Content-Type': 'application/json',
    },
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

const getPreviewUrl = (relativePath) => {
  const normalizedPath = normalizePath(relativePath);
  if (!normalizedPath) {
    return null;
  }

  const params = new URLSearchParams({ path: normalizedPath });
  return buildUrl(`/api/preview?${params.toString()}`);
};

export {
  apiBase,
  browse,
  getVolumes,
  copyItems,
  moveItems,
  deleteItems,
  fetchFileContent,
  saveFileContent,
  downloadItems,
  getPreviewUrl,
  normalizePath,
  encodePath,
};

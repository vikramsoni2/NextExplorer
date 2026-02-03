import { requestJson, normalizePath } from './http';

export async function fetchCollaboraConfig(path, mode = 'edit') {
  const normalizedPath = normalizePath(path || '');
  if (!normalizedPath) throw new Error('Path is required.');

  return requestJson('/api/collabora/config', {
    method: 'POST',
    body: JSON.stringify({ path: normalizedPath, mode }),
  });
}

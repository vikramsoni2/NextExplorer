// Centralized helpers for upload filtering

export const DISALLOWED_FILE_NAMES = new Set([
  '.ds_store',
  'thumbs.db',
]);

export function isDisallowedUpload(name) {
  if (!name || typeof name !== 'string') return false;
  return DISALLOWED_FILE_NAMES.has(name.toLowerCase());
}


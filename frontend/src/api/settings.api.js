// /api/settings.api.js

import { requestJson } from './http';

export async function getBranding() {
  return requestJson('/api/branding', { method: 'GET' });
}

export async function getSettings() {
  return requestJson('/api/settings', { method: 'GET' });
}

export async function patchSettings(partial) {
  return requestJson('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(partial || {}),
  });
}

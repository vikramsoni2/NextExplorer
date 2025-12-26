// /api/features.api.js

import { requestJson } from './http';

export async function fetchFeatures() {
  return requestJson('/api/features', { method: 'GET' });
}

// /api/index.js

// Export core helpers (optional, but can be useful)
export { apiBase, buildUrl, normalizePath, encodePath } from './http';

// Export all domain-specific functions
export * from './files.api';
export * from './shares.api';
export * from './auth.api';
export * from './users.api';
export * from './favorites.api';
export * from './settings.api';
export * from './onlyoffice.api';
export * from './features.api';
export * from './terminal.api';

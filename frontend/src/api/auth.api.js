// /api/auth.api.js

import { requestJson } from './http';

const fetchAuthStatus = () =>
  requestJson('/api/auth/status', { method: 'GET' });

const setupAccount = ({ email, username, password }) =>
  requestJson('/api/auth/setup', {
    method: 'POST',
    body: JSON.stringify({ email, username, password }),
  });

const fetchCurrentUser = () => requestJson('/api/auth/me', { method: 'GET' });

const login = ({ email, password }) =>
  requestJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

const logout = () =>
  requestJson('/api/auth/logout', {
    method: 'POST',
  });

async function changePassword({ currentPassword, newPassword }) {
  return requestJson('/api/auth/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export {
  fetchAuthStatus,
  setupAccount,
  fetchCurrentUser,
  login,
  logout,
  changePassword,
};

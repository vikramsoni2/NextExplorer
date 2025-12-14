const express = require('express');
const { listUsers, listShareableUsers, updateUserRoles, updateUserProfile, createLocalUser, setLocalPasswordAdmin, deleteUser, getById, countAdmins } = require('../services/users');
const asyncHandler = require('../utils/asyncHandler');
const { ForbiddenError, NotFoundError, ValidationError, UnauthorizedError } = require('../errors/AppError');

const router = express.Router();

const ensureAdmin = (req, res, next) => {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  if (!roles.includes('admin')) {
    throw new ForbiddenError('Admin access required.');
  }
  next();
};

// GET /api/users/shareable - list users for sharing (authenticated)
router.get('/users/shareable', asyncHandler(async (req, res) => {
  if (!req.user || !req.user.id) {
    throw new UnauthorizedError('Authentication required');
  }
  const users = await listShareableUsers({ excludeUserId: req.user.id });
  res.json({ users });
}));

// GET /api/users - list all users (admin only)
router.get('/users', ensureAdmin, asyncHandler(async (req, res) => {
  const users = await listUsers();
  res.json({ users });
}));

// PATCH /api/users/:id - update roles or profile (admin only)
router.patch('/users/:id', ensureAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params || {};
  const payload = req.body || {};
  const roles = Array.isArray(payload.roles) ? payload.roles : undefined;
  const existing = await getById(id);
  if (!existing) {
    throw new NotFoundError('User not found.');
  }

  let user = existing;

  if (Array.isArray(roles)) {
    const wasAdmin = Array.isArray(existing.roles) && existing.roles.includes('admin');
    const willBeAdmin = Array.isArray(roles) && roles.includes('admin');
    if (wasAdmin && !willBeAdmin) {
      throw new ValidationError('Demotion of admin is not allowed.');
    }
    user = await updateUserRoles({ userId: id, roles });
  }

  const hasProfileUpdates = ['email', 'username', 'displayName'].some((key) => typeof payload[key] === 'string');
  if (hasProfileUpdates) {
    user = await updateUserProfile({
      userId: id,
      email: payload.email,
      username: payload.username,
      displayName: payload.displayName,
    });
  }

  res.json({ user });
}));

// POST /api/users - create a new user (admin only)
router.post('/users', ensureAdmin, asyncHandler(async (req, res) => {
  const { email, username, password, displayName, roles } = req.body || {};
  const r = Array.isArray(roles) ? roles : [];
  const user = await createLocalUser({
    email,
    username: username || email?.split('@')[0],
    displayName: displayName || username || email?.split('@')[0],
    password,
    roles: r
  });
  res.status(201).json({ user });
}));

// POST /api/users/:id/password - admin reset local user's password
router.post('/users/:id/password', ensureAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params || {};
  const { newPassword } = req.body || {};
  await setLocalPasswordAdmin({ userId: id, newPassword });
  res.status(204).end();
}));

// DELETE /api/users/:id - remove a user (admin only)
router.delete('/users/:id', ensureAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params || {};
  // prevent self-delete via API
  if (req.user?.id === id) {
    throw new ValidationError('You cannot delete your own account.');
  }
  // Prevent removing last admin explicitly
  const existing = await getById(id);
  if (!existing) {
    throw new NotFoundError('User not found.');
  }
  if (Array.isArray(existing.roles) && existing.roles.includes('admin')) {
    const admins = await countAdmins();
    if (admins <= 1) {
      throw new ValidationError('Cannot remove the last admin.');
    }
  }
  await deleteUser({ userId: id });
  res.status(204).end();
}));

module.exports = router;

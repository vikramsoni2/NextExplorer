const express = require('express');
const { listUsers, updateUserRoles, createLocal, setLocalPasswordAdmin, deleteUser, getById, countAdmins } = require('../services/users');

const router = express.Router();

const ensureAdmin = (req, res, next) => {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  if (!roles.includes('admin')) {
    res.status(403).json({ error: 'Admin access required.' });
    return;
  }
  next();
};

// GET /api/users - list all users (admin only)
router.get('/users', ensureAdmin, async (req, res, next) => {
  try {
    const users = await listUsers();
    res.json({ users });
  } catch (e) {
    next(e);
  }
});

// PATCH /api/users/:id - update roles (admin only)
router.patch('/users/:id', ensureAdmin, async (req, res, next) => {
  try {
    const { id } = req.params || {};
    const roles = Array.isArray(req.body?.roles) ? req.body.roles : [];
    // Prevent admin demotion to align with backend policy
    const existing = await getById(id);
    if (!existing) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const wasAdmin = Array.isArray(existing.roles) && existing.roles.includes('admin');
    const willBeAdmin = Array.isArray(roles) && roles.includes('admin');
    if (wasAdmin && !willBeAdmin) {
      res.status(400).json({ error: 'Demotion of admin is not allowed.' });
      return;
    }
    const user = await updateUserRoles({ userId: id, roles });
    res.json({ user });
  } catch (e) {
    next(e);
  }
});

// POST /api/users - create a new local user (admin only)
router.post('/users', ensureAdmin, async (req, res, next) => {
  try {
    const { username, password, roles } = req.body || {};
    const r = Array.isArray(roles) ? roles : [];
    const user = await createLocal({ username, password, roles: r });
    res.status(201).json({ user });
  } catch (e) {
    const status = typeof e?.status === 'number' ? e.status : 400;
    res.status(status).json({ error: e?.message || 'Failed to create user.' });
  }
});

// POST /api/users/:id/password - admin reset local user's password
router.post('/users/:id/password', ensureAdmin, async (req, res, next) => {
  try {
    const { id } = req.params || {};
    const { newPassword } = req.body || {};
    await setLocalPasswordAdmin({ userId: id, newPassword });
    res.status(204).end();
  } catch (e) {
    const status = typeof e?.status === 'number' ? e.status : 400;
    res.status(status).json({ error: e?.message || 'Failed to set password.' });
  }
});

// DELETE /api/users/:id - remove a local user (admin only)
router.delete('/users/:id', ensureAdmin, async (req, res, next) => {
  try {
    const { id } = req.params || {};
    // prevent self-delete via API
    if (req.user?.id === id) {
      res.status(400).json({ error: 'You cannot delete your own account.' });
      return;
    }
    // Prevent removing last admin explicitly
    const existing = await getById(id);
    if (!existing) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (Array.isArray(existing.roles) && existing.roles.includes('admin')) {
      const admins = await countAdmins();
      if (admins <= 1) {
        res.status(400).json({ error: 'Cannot remove the last admin.' });
        return;
      }
    }
    await deleteUser({ userId: id });
    res.status(204).end();
  } catch (e) {
    const status = typeof e?.status === 'number' ? e.status : 400;
    res.status(status).json({ error: e?.message || 'Failed to remove user.' });
  }
});

module.exports = router;

const express = require('express');
const { listUsers, updateUserRoles } = require('../services/users');

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
    const user = await updateUserRoles({ userId: id, roles });
    res.json({ user });
  } catch (e) {
    next(e);
  }
});

module.exports = router;


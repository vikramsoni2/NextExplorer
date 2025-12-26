const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const terminalService = require('../services/terminalService');
const { UnauthorizedError, ForbiddenError } = require('../errors/AppError');

const router = express.Router();

// POST /api/terminal/session - issue short-lived terminal session token (admin only)
router.post(
  '/terminal/session',
  asyncHandler(async (req, res) => {
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Authentication required.');
    }

    const roles = Array.isArray(user.roles) ? user.roles : [];
    const isAdmin = roles.includes('admin');

    if (!isAdmin) {
      throw new ForbiddenError('Admin privileges required to open terminal.');
    }

    const token = terminalService.createSessionToken(user);

    res.json({ token });
  }),
);

module.exports = router;

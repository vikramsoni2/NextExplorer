const express = require('express');
const {
  getFavorites,
  addFavorite,
  removeFavorite,
  updateFavorite,
  reorderFavorites,
} = require('../services/favoritesService');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');
const { UnauthorizedError } = require('../errors/AppError');

const router = express.Router();

const requireAuth = (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError('Authentication required');
  }
  return next();
};

router.use('/favorites', requireAuth);

/**
 * GET /api/favorites
 * Get all favorites for the current user
 */
router.get('/favorites', asyncHandler(async (req, res) => {
  const favorites = await getFavorites(req.user.id);
  res.json(favorites);
}));

/**
 * POST /api/favorites
 * Add a new favorite for the current user
 */
router.post('/favorites', asyncHandler(async (req, res) => {
  const { path, label, icon, color } = req.body || {};
  const favorite = await addFavorite(req.user.id, { path, label, icon, color });
  res.json(favorite);
}));

/**
 * PATCH /api/favorites/reorder
 * Reorder favorites for the current user
 */
router.patch('/favorites/reorder', asyncHandler(async (req, res) => {
  const { order: orderedIds } = req.body || {};
  const favorites = await reorderFavorites(req.user.id, orderedIds);
  res.json(favorites);
}));

/**
 * PATCH /api/favorites/:id
 * Update a favorite's label or icon
 */
router.patch('/favorites/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { label, icon, color, position } = req.body || {};

  const favorite = await updateFavorite(req.user.id, id, { label, icon, color, position });
  res.json(favorite);
}));

/**
 * DELETE /api/favorites
 * Remove a favorite for the current user
 */
router.delete('/favorites', asyncHandler(async (req, res) => {
  const { path } = req.body || {};
  const favorites = await removeFavorite(req.user.id, path);
  res.json(favorites);
}));

module.exports = router;

const express = require('express');
const {
  getFavorites,
  addFavorite,
  removeFavorite,
  updateFavorite,
  reorderFavorites,
} = require('../services/favoritesService');
const logger = require('../utils/logger');

const router = express.Router();

const requireAuth = (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  return next();
};

router.use('/favorites', requireAuth);

/**
 * GET /api/favorites
 * Get all favorites for the current user
 */
router.get('/favorites', async (req, res) => {
  try {
    const favorites = await getFavorites(req.user.id);
    res.json(favorites);
  } catch (error) {
    logger.error({ err: error }, 'Failed to load favorites');
    res.status(500).json({ error: 'Failed to load favorites.' });
  }
});

/**
 * POST /api/favorites
 * Add a new favorite for the current user
 */
router.post('/favorites', async (req, res) => {
  try {
    const { path, label, icon } = req.body || {};
    const favorite = await addFavorite(req.user.id, { path, label, icon });
    res.json(favorite);
  } catch (error) {
    const status = typeof error?.status === 'number' ? error.status : 500;
    const message = error?.message || 'Failed to add favorite.';
    if (status >= 500) {
      logger.error({ err: error }, 'Failed to add favorite');
    }
    res.status(status).json({ error: message });
  }
});

/**
 * PATCH /api/favorites/reorder
 * Reorder favorites for the current user
 */
router.patch('/favorites/reorder', async (req, res) => {
  try {
    const { order: orderedIds } = req.body || {};
    const favorites = await reorderFavorites(req.user.id, orderedIds);
    res.json(favorites);
  } catch (error) {
    const status = typeof error?.status === 'number' ? error.status : 500;
    const message = error?.message || 'Failed to reorder favorites.';
    if (status >= 500) {
      logger.error({ err: error }, 'Failed to reorder favorites');
    }
    res.status(status).json({ error: message });
  }
});

/**
 * PATCH /api/favorites/:id
 * Update a favorite's label or icon
 */
router.patch('/favorites/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { label, icon, position } = req.body || {};

    const favorite = await updateFavorite(req.user.id, id, { label, icon, position });
    res.json(favorite);
  } catch (error) {
    const status = typeof error?.status === 'number' ? error.status : 500;
    const message = error?.message || 'Failed to update favorite.';
    if (status >= 500) {
      logger.error({ err: error }, 'Failed to update favorite');
    }
    res.status(status).json({ error: message });
  }
});

/**
 * DELETE /api/favorites
 * Remove a favorite for the current user
 */
router.delete('/favorites', async (req, res) => {
  try {
    const { path } = req.body || {};
    const favorites = await removeFavorite(req.user.id, path);
    res.json(favorites);
  } catch (error) {
    const status = typeof error?.status === 'number' ? error.status : 500;
    const message = error?.message || 'Failed to remove favorite.';
    if (status >= 500) {
      logger.error({ err: error }, 'Failed to remove favorite');
    }
    res.status(status).json({ error: message });
  }
});

module.exports = router;

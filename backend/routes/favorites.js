const express = require('express');

const { getFavorites, addFavorite, removeFavorite } = require('../services/appConfigService');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/favorites', async (req, res) => {
  try {
    const favorites = await getFavorites();
    res.json(favorites);
  } catch (error) {
    logger.error({ err: error }, 'Failed to load favorites');
    res.status(500).json({ error: 'Failed to load favorites.' });
  }
});

router.post('/favorites', async (req, res) => {
  try {
    const { path, icon } = req.body || {};
    const favorite = await addFavorite({ path, icon });
    res.json(favorite);
  } catch (error) {
    const status = typeof error?.status === 'number' ? error.status : 500;
    const message = error?.message || 'Failed to update favorites.';
    if (status >= 500) {
      logger.error({ err: error }, 'Failed to add favorite');
    }
    res.status(status).json({ error: message });
  }
});

router.delete('/favorites', async (req, res) => {
  try {
    const { path } = req.body || {};
    const favorites = await removeFavorite(path);
    res.json(favorites);
  } catch (error) {
    const status = typeof error?.status === 'number' ? error.status : 500;
    const message = error?.message || 'Failed to update favorites.';
    if (status >= 500) {
      logger.error({ err: error }, 'Failed to remove favorite');
    }
    res.status(status).json({ error: message });
  }
});

module.exports = router;

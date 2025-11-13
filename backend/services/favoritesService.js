const fs = require('fs/promises');
const storage = require('./storage/jsonStorage');
const { normalizeRelativePath, resolveVolumePath } = require('../utils/pathUtils');

/**
 * Validate and sanitize a favorite
 */
const sanitize = (favorite) => {
  if (!favorite?.path) return null;
  
  try {
    const path = normalizeRelativePath(favorite.path);
    if (!path) return null;
    
    return {
      path,
      icon: favorite.icon?.trim() || 'solid:StarIcon',
    };
  } catch {
    return null;
  }
};

/**
 * Ensure path exists and is a directory
 */
const validatePath = async (relativePath) => {
  const absolutePath = resolveVolumePath(relativePath);
  const stats = await fs.stat(absolutePath);
  
  if (!stats.isDirectory()) {
    const err = new Error('Path must be a directory');
    err.status = 400;
    throw err;
  }
};

const getFavorites = async () => {
  const data = await storage.get();
  return (data.favorites || []).map(f => ({ ...f }));
};

const addFavorite = async ({ path, icon }) => {
  const favorite = sanitize({ path, icon });
  if (!favorite) {
    const err = new Error('Invalid path');
    err.status = 400;
    throw err;
  }
  
  await validatePath(favorite.path);
  
  const updated = await storage.update((data) => {
    const favorites = data.favorites || [];
    const index = favorites.findIndex(f => f.path === favorite.path);
    
    if (index >= 0) {
      favorites[index] = favorite;
    } else {
      favorites.push(favorite);
    }
    
    return { ...data, favorites };
  });
  
  return updated.favorites.find(f => f.path === favorite.path);
};

const removeFavorite = async (path) => {
  const normalizedPath = normalizeRelativePath(path);
  
  const updated = await storage.update((data) => ({
    ...data,
    favorites: (data.favorites || []).filter(f => f.path !== normalizedPath),
  }));
  
  return updated.favorites;
};

module.exports = { getFavorites, addFavorite, removeFavorite };
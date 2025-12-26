const path = require('path');
const fs = require('fs');
const express = require('express');
const { directories } = require('../config/index');
const logger = require('./logger');

/**
 * Configures static file serving for thumbnails and frontend
 */
const configureStaticFiles = (app) => {
  // Serve thumbnails
  app.use('/static/thumbnails', express.static(directories.thumbnails));
  logger.debug('Mounted /static/thumbnails');

  // Serve frontend SPA
  const frontendDir = path.resolve(__dirname, '..', 'public');
  const indexFile = path.join(frontendDir, 'index.html');

  if (fs.existsSync(frontendDir) && fs.existsSync(indexFile)) {
    app.use(express.static(frontendDir));
    logger.debug({ frontendDir, indexFile }, 'Mounted static frontend');

    // SPA fallback - serve index.html for all non-API routes
    app.get('*', (req, res, next) => {
      // Skip API routes
      if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/static/thumbnails')
      ) {
        return next();
      }

      // Only handle GET and HEAD requests
      if (!['GET', 'HEAD'].includes(req.method)) {
        return next();
      }

      res.sendFile(indexFile);
    });

    logger.debug('Configured SPA fallback routing');
  } else {
    logger.warn(
      { frontendDir, indexFile },
      'Frontend directory or index.html not found - skipping static file serving',
    );
  }
};

module.exports = { configureStaticFiles };

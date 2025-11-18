/**
 * Async handler wrapper for Express routes
 * Automatically catches errors in async route handlers and passes them to error middleware
 *
 * Usage:
 *   router.get('/example', asyncHandler(async (req, res) => {
 *     const data = await someAsyncOperation();
 *     res.json(data);
 *   }));
 *
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;

const { ForbiddenError } = require('../errors/AppError');

/**
 * Allow only administrators past this point.
 *
 * Several route files carried their own copy of this check, which is how
 * /permissions/chmod and /permissions/chown ended up with none at all.
 */
const ensureAdmin = (req, _res, next) => {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  if (!roles.includes('admin')) {
    throw new ForbiddenError('Admin access required.');
  }
  next();
};

module.exports = { ensureAdmin };

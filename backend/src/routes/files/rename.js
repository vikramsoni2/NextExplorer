const path = require('path');
const fs = require('fs/promises');
const {
  normalizeRelativePath,
  combineRelativePath,
  ensureValidName,
} = require('../../utils/pathUtils');
const { pathExists } = require('../../utils/fsUtils');
const {
  ACTIONS,
  authorizeAndResolve,
  authorizePath,
} = require('../../services/authorizationService');
const asyncHandler = require('../../utils/asyncHandler');
const {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} = require('../../errors/AppError');
const { buildItemMetadata } = require('./utils');

const router = require('express').Router();

router.post(
  '/files/rename',
  asyncHandler(async (req, res) => {
    const parentPath = req.body?.path ?? '';
    const originalName = req.body?.name;
    const newNameRaw = req.body?.newName;

    if (typeof originalName !== 'string' || !originalName) {
      throw new ValidationError('Original name is required.');
    }

    const parentRelative = normalizeRelativePath(parentPath);
    const context = { user: req.user, guestSession: req.guestSession };

    const {
      allowed: parentAllowed,
      accessInfo: parentAccess,
      resolved: parentResolved,
    } = await authorizeAndResolve(context, parentRelative, ACTIONS.write);
    if (!parentAllowed || !parentResolved) {
      throw new ForbiddenError(parentAccess?.denialReason || 'Destination path is read-only.');
    }

    const { absolutePath: parentAbsolute } = parentResolved;

    const currentRelative = combineRelativePath(parentRelative, originalName);
    const {
      allowed: currentAllowed,
      accessInfo: currentAccess,
      resolved: currentResolved,
    } = await authorizeAndResolve(context, currentRelative, ACTIONS.write);
    if (!currentAllowed || !currentResolved) {
      throw new ForbiddenError(currentAccess?.denialReason || 'Cannot rename items in this path.');
    }

    const { absolutePath: currentAbsolute } = currentResolved;

    if (!(await pathExists(currentAbsolute))) {
      throw new NotFoundError('Item not found.');
    }

    const validatedNewName = typeof newNameRaw === 'string' ? ensureValidName(newNameRaw) : null;

    if (!validatedNewName) {
      throw new ValidationError('A new name is required.');
    }

    if (validatedNewName === originalName) {
      const item = await buildItemMetadata(currentAbsolute, parentRelative, originalName);
      res.json({ success: true, item });
      return;
    }

    const targetRelative = combineRelativePath(parentRelative, validatedNewName);
    const { allowed: targetAllowed, accessInfo: targetAccess } = await authorizePath(
      context,
      targetRelative,
      ACTIONS.write
    );
    if (!targetAllowed) {
      throw new ForbiddenError(targetAccess?.denialReason || 'Destination path is not accessible.');
    }
    const targetAbsolute = path.join(parentAbsolute, validatedNewName);

    if (await pathExists(targetAbsolute)) {
      throw new ConflictError(`The name "${validatedNewName}" is already taken.`);
    }

    await fs.rename(currentAbsolute, targetAbsolute);

    const item = await buildItemMetadata(targetAbsolute, parentRelative, validatedNewName);
    res.json({ success: true, item });
  })
);

module.exports = router;

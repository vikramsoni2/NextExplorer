const { normalizeRelativePath, combineRelativePath } = require('../../utils/pathUtils');
const { transferItems } = require('../../services/fileTransferService');
const { getPermissionForPath } = require('../../services/accessControlService');
const asyncHandler = require('../../utils/asyncHandler');
const { ForbiddenError } = require('../../errors/AppError');
const { assertWritable } = require('./utils');

const router = require('express').Router();

router.post(
  '/files/copy',
  asyncHandler(async (req, res) => {
    const { items = [], destination = '' } = req.body || {};
    // validate read on each source (hidden not allowed), write on destination
    for (const item of items) {
      if (!item || !item.name) continue;
      const srcRel = combineRelativePath(normalizeRelativePath(item.path || ''), item.name);
      const perm = await getPermissionForPath(srcRel);
      if (perm === 'hidden') {
        throw new ForbiddenError('Source path is not accessible.');
      }
    }
    await assertWritable(normalizeRelativePath(destination));

    const result = await transferItems(items, destination, 'copy', {
      user: req.user,
      guestSession: req.guestSession,
    });
    res.json({ success: true, ...result });
  })
);

router.post(
  '/files/move',
  asyncHandler(async (req, res) => {
    const { items = [], destination = '' } = req.body || {};
    for (const item of items) {
      const parent = normalizeRelativePath(item?.path || '');
      await assertWritable(parent);
    }
    await assertWritable(normalizeRelativePath(destination));

    const result = await transferItems(items, destination, 'move', {
      user: req.user,
      guestSession: req.guestSession,
    });
    res.json({ success: true, ...result });
  })
);

module.exports = router;

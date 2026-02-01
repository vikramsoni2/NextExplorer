const { normalizeRelativePath } = require('../../utils/pathUtils');
const { deleteItems } = require('../../services/fileTransferService');
const asyncHandler = require('../../utils/asyncHandler');
const { assertWritable } = require('./utils');

const router = require('express').Router();

router.delete(
  '/files',
  asyncHandler(async (req, res) => {
    const { items = [] } = req.body || {};
    for (const item of items) {
      const parent = normalizeRelativePath(item?.path || '');
      await assertWritable(parent);
    }
    const results = await deleteItems(items, {
      user: req.user,
      guestSession: req.guestSession,
    });
    res.json({ success: true, items: results });
  })
);

module.exports = router;

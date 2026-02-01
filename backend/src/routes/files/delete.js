const { deleteItems } = require('../../services/fileTransferService');
const asyncHandler = require('../../utils/asyncHandler');

const router = require('express').Router();

router.delete(
  '/files',
  asyncHandler(async (req, res) => {
    const { items = [] } = req.body || {};
    const results = await deleteItems(items, {
      user: req.user,
      guestSession: req.guestSession,
    });
    res.json({ success: true, items: results });
  })
);

module.exports = router;

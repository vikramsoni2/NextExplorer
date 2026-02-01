const { transferItems } = require('../../services/fileTransferService');
const asyncHandler = require('../../utils/asyncHandler');

const router = require('express').Router();

router.post(
  '/files/copy',
  asyncHandler(async (req, res) => {
    const { items = [], destination = '' } = req.body || {};
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
    const result = await transferItems(items, destination, 'move', {
      user: req.user,
      guestSession: req.guestSession,
    });
    res.json({ success: true, ...result });
  })
);

module.exports = router;

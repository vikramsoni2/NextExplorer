const express = require('express');
const { promisify } = require('util');
const { exec } = require('child_process');
const { normalizeRelativePath } = require('../utils/pathUtils');
const { resolvePathWithAccess } = require('../services/accessManager');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');
const execp = promisify(exec);
const router = express.Router();

// Fast directory size using du command
const dirSize = async (root) => {
  try {
    // -sb: summarize in bytes, don't follow symlinks
    // This is orders of magnitude faster than fs.stat() recursion
    const { stdout } = await execp(`du -sb "${root}"`, {
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer for large outputs
    });
    
    // Output format: "12345\t/path/to/dir"
    const size = parseInt(stdout.split('\t')[0], 10);
    return size || 0;
  } catch (err) {
    logger.debug(err)
    return 0;
  }
};

router.get('/usage/*', asyncHandler(async (req, res) => {
  const raw = req.params[0] || '';
  const inputRel = normalizeRelativePath(raw);
  const context = { user: req.user, guestSession: req.guestSession };

  const { accessInfo, resolved } = await resolvePathWithAccess(context, inputRel);

  if (!accessInfo || !accessInfo.canAccess || !accessInfo.canRead) {
    // Treat denied access the same as du failing; zero usage
    return res.json({ path: inputRel, size: 0, free: 0, total: 0 });
  }

  const { absolutePath: abs, relativePath: rel } = resolved;

  // Run both commands in parallel for maximum speed
  const [size, dfResult] = await Promise.all([
    dirSize(abs),
    execp(`df -Pk "${abs}"`).catch(() => ({ stdout: '' }))
  ]);

  let total = 0, free = 0;

  if (dfResult.stdout) {
    const line = dfResult.stdout.trim().split('\n').pop();
    const parts = line.trim().split(/\s+/);
    const totalKb = parseInt(parts[1], 10) || 0;
    const availKb = parseInt(parts[3], 10) || 0;
    total = totalKb * 1024;
    free = availKb * 1024;
  }

  res.json({ path: rel, size, free, total });
}));

module.exports = router;

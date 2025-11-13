const express = require('express');
const { promisify } = require('util');
const { exec } = require('child_process');
const { normalizeRelativePath, resolveVolumePath } = require('../utils/pathUtils');
const logger = require('../utils/logger');
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

router.get('/usage/*', async (req, res) => {
  try {
    const rel = normalizeRelativePath(req.params[0] || '');
    const abs = resolveVolumePath(rel);
    
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
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute usage.' });
  }
});

module.exports = router;
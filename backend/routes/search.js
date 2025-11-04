const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');

const { normalizeRelativePath, resolveVolumePath } = require('../utils/pathUtils');
const { pathExists } = require('../utils/fsUtils');
const { excludedFiles } = require('../config/index');
const { getPermissionForPath } = require('../services/accessControlService');
const logger = require('../utils/logger');

const router = express.Router();

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build']);
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 5000;
const CONTENT_FALLBACK_MAX_SIZE = 5 * 1024 * 1024; // 5MB

function toLimit(value, def = DEFAULT_LIMIT) {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) {
    return Math.min(n, MAX_LIMIT);
  }
  return def;
}

async function isDirectory(p) {
  try {
    const st = await fs.stat(p);
    return st.isDirectory();
  } catch {
    return false;
  }
}

function hasRipgrep() {
  return new Promise((resolve) => {
    const child = spawn('rg', ['--version']);
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
}

function collectStdout(child) {
  return new Promise((resolve, reject) => {
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 || (code === 1 && out)) {
        // rg returns 1 for no matches; still return output
        resolve({ out, err, code });
      } else {
        resolve({ out: '', err, code });
      }
    });
  });
}

async function runRipgrepSearch(baseAbsPath, relBasePath, term, limit) {
  const globArgs = ['-g', '!.git', '-g', '!node_modules', '-g', '!dist', '-g', '!build'];

  // Content matches (-l prints matching files only)
  const rgContentArgs = [
    '-l', '--hidden', '--no-messages', '--smart-case', '-F', term, '.',
    ...globArgs,
  ];
  const contentProc = spawn('rg', rgContentArgs, { cwd: baseAbsPath });
  const contentRes = await collectStdout(contentProc);
  const fileSet = new Set(
    contentRes.out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((p) => (relBasePath ? path.posix.join(relBasePath, p.replace(/\\/g, '/')) : p.replace(/\\/g, '/')))
  );

  // Filename matches and derive directory matches from file listing
  const rgListArgs = ['--files', '--hidden', '--no-messages', ...globArgs];
  const listProc = spawn('rg', rgListArgs, { cwd: baseAbsPath });
  const listRes = await collectStdout(listProc);
  const needle = term.toLowerCase();
  const dirSet = new Set();

  for (const line of listRes.out.split(/\r?\n/)) {
    const rel = line.trim();
    if (!rel) continue;
    const normalizedRel = rel.replace(/\\/g, '/');
    const fullRel = relBasePath ? path.posix.join(relBasePath, normalizedRel) : normalizedRel;

    // Check filename
    const base = path.posix.basename(fullRel).toLowerCase();
    if (base.includes(needle)) {
      fileSet.add(fullRel);
    }

    // Derive and check directory names from the file path
    const dirRel = path.posix.dirname(fullRel);
    if (dirRel && dirRel !== '.') {
      const parts = dirRel.split('/');
      let acc = '';
      for (const part of parts) {
        if (!part) continue;
        if (IGNORED_DIRS.has(part)) continue;
        if (excludedFiles.includes(part)) continue;
        acc = acc ? `${acc}/${part}` : part;
        if (part.toLowerCase().includes(needle)) {
          dirSet.add(acc);
        }
      }
    }

    if (fileSet.size + dirSet.size >= limit) {
      // We've likely collected enough candidates; continue mapping & filtering later
      // but we can stop early here to avoid excessive processing.
      break;
    }
  }

  const results = [];
  for (const rel of fileSet) results.push({ rel, kind: 'file' });
  for (const rel of dirSet) results.push({ rel, kind: 'dir' });
  return results;
}

async function fallbackSearch(baseAbsPath, relBasePath, term, limit) {
  const fileResults = new Set();
  const dirResults = new Set();
  const needle = term.toLowerCase();

  async function walk(dirAbs, dirRel) {
    const dirents = await fs.readdir(dirAbs, { withFileTypes: true });
    for (const d of dirents) {
      if (fileResults.size + dirResults.size >= limit) break;
      const name = d.name;
      if (IGNORED_DIRS.has(name)) continue;
      if (excludedFiles.includes(name)) continue;

      const abs = path.join(dirAbs, name);
      const rel = dirRel ? path.posix.join(dirRel, name) : name;

      if (d.isDirectory()) {
        // directory name match
        if (name.toLowerCase().includes(needle)) {
          dirResults.add(rel);
          if (fileResults.size + dirResults.size >= limit) continue; // still walk to find deeper matches
        }
        await walk(abs, rel);
      } else if (d.isFile()) {
        // filename match
        if (name.toLowerCase().includes(needle)) {
          fileResults.add(rel);
          if (fileResults.size + dirResults.size >= limit) break;
          continue;
        }
        // content match (small files only)
        try {
          const st = await fs.stat(abs);
          if (st.size <= CONTENT_FALLBACK_MAX_SIZE) {
            const content = await fs.readFile(abs, 'utf8');
            if (content.toLowerCase().includes(needle)) {
              fileResults.add(rel);
              if (fileResults.size + dirResults.size >= limit) break;
            }
          }
        } catch {
          // ignore read/encoding errors
        }
      }
    }
  }

  await walk(baseAbsPath, relBasePath);
  const results = [];
  for (const rel of fileResults) results.push({ rel, kind: 'file' });
  for (const rel of dirResults) results.push({ rel, kind: 'dir' });
  return results;
}

router.get('/search', async (req, res) => {
  try {
    const qRaw = typeof req.query.q === 'string' ? req.query.q : '';
    const q = qRaw.trim();
    if (!q) {
      return res.status(400).json({ error: 'Search term (q) is required.' });
    }

    const relBase = normalizeRelativePath(req.query.path || '');
    const baseAbs = resolveVolumePath(relBase);

    if (!(await pathExists(baseAbs))) {
      return res.status(404).json({ error: 'Base path not found.' });
    }
    if (!(await isDirectory(baseAbs))) {
      return res.status(400).json({ error: 'Search base path must be a directory.' });
    }

    const limit = toLimit(req.query.limit);

    const useRipgrep = await hasRipgrep();
    let entries = [];
    if (useRipgrep) {
      entries = await runRipgrepSearch(baseAbs, relBase, q, limit);
    } else {
      entries = await fallbackSearch(baseAbs, relBase, q, limit);
    }

    // Map/normalize and filter hidden/excluded; include kind
    const items = [];
    for (const entry of entries) {
      const rel = entry?.rel;
      const kind = entry?.kind === 'dir' ? 'dir' : 'file';
      if (!rel) continue;
      const name = path.posix.basename(rel);
      if (excludedFiles.includes(name)) continue;
      const perm = await getPermissionForPath(rel);
      if (perm === 'hidden') continue;
      const parent = path.posix.dirname(rel);
      items.push({ name, path: parent === '.' ? '' : parent, kind });
      if (items.length >= limit) break;
    }

    res.json({ items });
  } catch (error) {
    logger.error({ err: error }, 'Search failed');
    res.status(500).json({ error: 'Search failed.' });
  }
});

module.exports = router;

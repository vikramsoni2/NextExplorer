const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');
const readline = require('readline');

const { normalizeRelativePath } = require('../utils/pathUtils');
const { pathExists } = require('../utils/fsUtils');
const { excludedFiles, search: searchConfig } = require('../config/index');
const { getPermissionForPath } = require('../services/accessControlService');
const { resolvePathWithAccess } = require('../services/accessManager');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');
const { ValidationError, NotFoundError, ForbiddenError } = require('../errors/AppError');

const router = express.Router();

// Constants
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build']);
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const CONTENT_FALLBACK_MAX_SIZE = searchConfig?.maxFileSizeBytes > 0 
  ? searchConfig.maxFileSizeBytes 
  : 5 * 1024 * 1024;

// Cache ripgrep availability (Optimization #4)
let ripgrepAvailable = null;

// Utilities
const toLimit = (value, def = DEFAULT_LIMIT) => {
  const n = Number(value);
  return (Number.isFinite(n) && n > 0) ? Math.min(n, MAX_LIMIT) : def;
};

const isDirectory = async (p) => {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
};

// Cached ripgrep check (Optimization #4)
const hasRipgrep = async () => {
  if (ripgrepAvailable !== null) return ripgrepAvailable;
  
  ripgrepAvailable = await new Promise((resolve) => {
    const child = spawn('rg', ['--version']);
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
  
  return ripgrepAvailable;
};

// Search implementations
const buildRipgrepArgs = () => ['-g', '!.git', '-g', '!node_modules', '-g', '!dist', '-g', '!build'];

const normalizePath = (p, relBasePath) => {
  const normalized = p.replace(/\\/g, '/');
  return relBasePath ? path.posix.join(relBasePath, normalized) : normalized;
};

const shouldIgnore = (name) => IGNORED_DIRS.has(name) || excludedFiles.includes(name);

const extractDirMatches = (fullPath, needle) => {
  const dirs = new Set();
  const dirPath = path.posix.dirname(fullPath);
  
  if (dirPath && dirPath !== '.') {
    const parts = dirPath.split('/');
    let acc = '';
    
    for (const part of parts) {
      if (!part || shouldIgnore(part)) continue;
      acc = acc ? `${acc}/${part}` : part;
      if (part.toLowerCase().includes(needle)) dirs.add(acc);
    }
  }
  
  return dirs;
};

const shouldIncludeResult = async (rel) => {
  const name = path.posix.basename(rel);
  if (excludedFiles.includes(name)) return false;
  if (await getPermissionForPath(rel) === 'hidden') return false;
  return true;
};

const formatResult = (rel, kind, line, lineNumber) => {
  const parent = path.posix.dirname(rel);
  const item = { 
    name: path.posix.basename(rel), 
    path: parent === '.' ? '' : parent, 
    kind 
  };
  
  if (line != null) {
    item.matchLine = line;
    if (Number.isFinite(lineNumber)) item.matchLineNumber = lineNumber;
  }
  
  return item;
};

// Helper to safely parse JSON lines (Optimization #2)
const parseJsonLine = (line) => {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
};

// Optimized: Stream file list results (Optimization #1 & #3)
async function* streamFileListMatches(baseAbsPath, relBasePath, needle, seenPaths, dirSet) {
  const globArgs = buildRipgrepArgs();
  const fileListProcess = spawn('rg', 
    ['--files', '--hidden', '--no-messages', ...globArgs], 
    { cwd: baseAbsPath }
  );

  const rl = readline.createInterface({
    input: fileListProcess.stdout,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const fullRel = normalizePath(trimmed, relBasePath);
    
    // Extract and yield directory matches immediately
    for (const dirPath of extractDirMatches(fullRel, needle)) {
      if (!dirSet.has(dirPath) && !seenPaths.has(dirPath)) {
        dirSet.add(dirPath);
        seenPaths.add(dirPath);
        if (await shouldIncludeResult(dirPath)) {
          yield formatResult(dirPath, 'dir');
        }
      }
    }

    // Check filename match and yield immediately
    const baseName = path.posix.basename(fullRel).toLowerCase();
    if (baseName.includes(needle) && !seenPaths.has(fullRel)) {
      seenPaths.add(fullRel);
      if (await shouldIncludeResult(fullRel)) {
        yield formatResult(fullRel, 'file');
      }
    }
  }
}

// Optimized: Stream content matches with JSON output (Optimization #1 & #2)
async function* streamContentMatches(baseAbsPath, relBasePath, term, seenPaths) {
  const globArgs = buildRipgrepArgs();
  
  const contentArgs = [
    '--json', // Use JSON output for faster parsing (Optimization #2)
    '-n', '-H', '--hidden', '--no-messages', 
    '--smart-case', '-F', term, '.', '-m', '1', ...globArgs
  ];
  
  if (searchConfig?.maxFileSize) {
    contentArgs.unshift('--max-filesize', searchConfig.maxFileSize);
  }

  const contentProcess = spawn('rg', contentArgs, { cwd: baseAbsPath });
  const rl = readline.createInterface({
    input: contentProcess.stdout,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    const data = parseJsonLine(line);
    if (!data || data.type !== 'match') continue;

    const filePath = data.data?.path?.text;
    if (!filePath) continue;

    const lineNum = data.data?.line_number;
    const lineText = data.data?.lines?.text;

    const rel = normalizePath(filePath, relBasePath);
    if (seenPaths.has(rel)) continue;
    
    seenPaths.add(rel);
    if (await shouldIncludeResult(rel)) {
      yield formatResult(rel, 'file', lineText, lineNum);
    }
  }
}

// Optimized ripgrep with parallel execution (Optimization #1, #2, #3)
async function* generateRipgrepResults(baseAbsPath, relBasePath, term, deep = true) {
  const needle = term.toLowerCase();
  const seenPaths = new Set();
  const dirSet = new Set();

  if (!deep) {
    // If no deep search, only run file list matches
    yield* streamFileListMatches(baseAbsPath, relBasePath, needle, seenPaths, dirSet);
    return;
  }

  // Optimization #3: Run both searches in parallel
  const fileListGen = streamFileListMatches(baseAbsPath, relBasePath, needle, seenPaths, dirSet);
  const contentGen = streamContentMatches(baseAbsPath, relBasePath, term, seenPaths);

  // Yield from file list first (directories and filename matches)
  for await (const result of fileListGen) {
    yield result;
  }

  // Then yield content matches
  for await (const result of contentGen) {
    yield result;
  }
}

// Optimized fallback with streaming (Optimization #1)
async function* generateFallbackResults(baseAbsPath, relBasePath, term, deep = true) {
  const seenPaths = new Set();
  const needle = term.toLowerCase();

  // Yield results immediately as we find them
  const walk = async function* (dirAbs, dirRel) {
    let dirents;
    try {
      dirents = await fs.readdir(dirAbs, { withFileTypes: true });
    } catch {
      return; // Skip directories we can't read
    }
    
    for (const d of dirents) {
      if (shouldIgnore(d.name)) continue;
      
      const abs = path.join(dirAbs, d.name);
      const rel = dirRel ? path.posix.join(dirRel, d.name) : d.name;

      if (d.isDirectory()) {
        if (d.name.toLowerCase().includes(needle) && !seenPaths.has(rel)) {
          seenPaths.add(rel);
          if (await shouldIncludeResult(rel)) {
            yield formatResult(rel, 'dir');
          }
        }
        yield* walk(abs, rel);
      } else if (d.isFile()) {
        if (d.name.toLowerCase().includes(needle) && !seenPaths.has(rel)) {
          seenPaths.add(rel);
          if (await shouldIncludeResult(rel)) {
            yield formatResult(rel, 'file');
          }
        } else if (deep && !seenPaths.has(rel)) {
          try {
            const st = await fs.stat(abs);
            if (st.size <= CONTENT_FALLBACK_MAX_SIZE) {
              const content = await fs.readFile(abs, 'utf8');
              const lower = content.toLowerCase();
              const idx = lower.indexOf(needle);
              
              if (idx !== -1) {
                const lineNumber = (content.slice(0, idx).match(/\n/g)?.length ?? 0) + 1;
                const matchedLine = content.split(/\r?\n/)[lineNumber - 1] || '';
                seenPaths.add(rel);
                if (await shouldIncludeResult(rel)) {
                  yield formatResult(rel, 'file', matchedLine, lineNumber);
                }
              }
            }
          } catch {
            // Ignore read/encoding errors
          }
        }
      }
    }
  };

  yield* walk(baseAbsPath, relBasePath);
}

router.get('/search', asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    throw new ValidationError('Search term (q) is required.');
  }

  const relBaseInput = normalizeRelativePath(req.query.path || '');

  const context = { user: req.user, guestSession: req.guestSession };
  let accessInfo;
  let resolvedBase;
  try {
    ({ accessInfo, resolved: resolvedBase } = await resolvePathWithAccess(context, relBaseInput));
  } catch (error) {
    throw new NotFoundError('Base path not found.');
  }

  if (!accessInfo || !accessInfo.canAccess || !accessInfo.canRead) {
    throw new ForbiddenError(accessInfo?.denialReason || 'Search base is not accessible.');
  }

  const baseAbs = resolvedBase.absolutePath;
  const relBase = resolvedBase.relativePath;

  if (!(await pathExists(baseAbs))) {
    throw new NotFoundError('Base path not found.');
  }
  if (!(await isDirectory(baseAbs))) {
    throw new ValidationError('Search base path must be a directory.');
  }

  const limit = toLimit(req.query.limit);
  const ripgrepAllowed = searchConfig?.ripgrep !== false;
  const useRipgrep = ripgrepAllowed && await hasRipgrep();
  const deepEnabled = searchConfig?.deep !== false;

  const generator = useRipgrep
    ? generateRipgrepResults(baseAbs, relBase, q, deepEnabled)
    : generateFallbackResults(baseAbs, relBase, q, deepEnabled);

  const items = [];
  for await (const item of generator) {
    items.push(item);
    if (items.length >= limit) break;
  }

  res.json({ items });
}));

module.exports = router;

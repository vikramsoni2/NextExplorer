const path = require('path');
const fs = require('fs/promises');
const { normalizeRelativePath, combineRelativePath } = require('../../utils/pathUtils');
const { getPermissionForPath } = require('../../services/accessControlService');
const {
  ValidationError,
  ForbiddenError,
} = require('../../errors/AppError');

const assertWritable = async (relativePath) => {
  const perm = await getPermissionForPath(relativePath);
  if (perm !== 'rw') {
    throw new ForbiddenError('Path is read-only.');
  }
};

const buildItemMetadata = async (absolutePath, relativeParent, name) => {
  const stats = await fs.stat(absolutePath);
  const kind = stats.isDirectory()
    ? 'directory'
    : (() => {
        const extension = path.extname(name).slice(1).toLowerCase();
        return extension.length > 10 ? 'unknown' : extension || 'unknown';
      })();

  return {
    name,
    path: relativeParent,
    kind,
    size: stats.size,
    dateModified: stats.mtime,
  };
};

const collectInputPaths = (...sources) => {
  const collected = [];

  const add = (value) => {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }

    if (typeof value === 'string') {
      if (value.trim()) {
        collected.push(value);
      }
      return;
    }

    if (value && typeof value === 'object') {
      if (typeof value.relativePath === 'string') {
        add(value.relativePath);
        return;
      }

      if (typeof value.path === 'string' && typeof value.name === 'string') {
        try {
          add(combineRelativePath(value.path, value.name));
        } catch (error) {
          // ignore invalid combined paths and continue collecting
        }
        return;
      }

      if (typeof value.path === 'string') {
        add(value.path);
      }
    }
  };

  sources.forEach(add);
  return collected;
};

const toPosix = (value = '') => value.replace(/\\/g, '/');

const encodeContentDisposition = (filename) => {
  // Check if filename contains non-ASCII characters
  const hasNonAscii = /[^\x00-\x7F]/.test(filename);

  if (!hasNonAscii) {
    // Simple case: filename is ASCII-only
    return `attachment; filename="${filename}"`;
  }

  // For non-ASCII filenames, use RFC 5987 encoding
  // Create ASCII fallback (replace non-ASCII with underscores)
  const asciiFallback = filename.replace(/[^\x00-\x7F]/g, '_');

  // Encode filename for filename* parameter (RFC 5987)
  const encodedFilename = encodeURIComponent(filename);

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`;
};

const stripBasePath = (relativePath, basePath) => {
  const relPosix = toPosix(relativePath);
  const basePosix = toPosix(basePath);

  if (!basePosix) {
    return relPosix;
  }

  if (relPosix === basePosix) {
    const segments = relPosix.split('/');
    return segments[segments.length - 1] || relPosix;
  }

  const basePrefix = basePosix.endsWith('/') ? basePosix : `${basePosix}/`;
  if (relPosix.startsWith(basePrefix)) {
    const trimmed = relPosix.slice(basePrefix.length);
    return trimmed || relPosix.split('/').pop() || relPosix;
  }

  return relPosix;
};

module.exports = {
  assertWritable,
  buildItemMetadata,
  collectInputPaths,
  toPosix,
  encodeContentDisposition,
  stripBasePath,
};

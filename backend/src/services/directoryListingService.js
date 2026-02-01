const path = require('path');
const fs = require('fs/promises');

const { excludedFiles, extensions } = require('../config/index');
const { combineRelativePath } = require('../utils/pathUtils');
const { getAccessInfo } = require('./accessManager');
const { createPermissionResolver } = require('./accessControlService');
const logger = require('../utils/logger');

const previewable = new Set([
  ...extensions.images,
  ...(extensions.rawImages || []),
  ...extensions.videos,
  ...(extensions.documents || []),
]);

const toKind = (stats, name) => {
  if (stats.isDirectory()) return 'directory';
  const ext = path.extname(name).slice(1).toLowerCase();
  if (!ext) return 'unknown';
  return ext.length > 10 ? 'unknown' : ext;
};

/**
 * List a directory and filter out entries that the caller cannot access.
 *
 * - Uses accessManager for per-child visibility (covers shares + user volumes + hidden rules).
 * - Does not throw for child-level failures; unreadable / inaccessible children are skipped.
 */
const listDirectoryItems = async ({
  absoluteDir,
  parentLogicalPath,
  context,
  thumbsEnabled,
  excludeDownloadArtifacts = false,
  itemExtras = null,
  permissionRules = null,
  shareCache = null,
  userVolumeCache = null,
}) => {
  const permissionResolver =
    Array.isArray(permissionRules) && permissionRules.length
      ? createPermissionResolver(permissionRules)
      : null;

  const accessOptions = {
    ...(permissionResolver ? { permissionResolver } : null),
    ...(shareCache instanceof Map ? { shareCache } : null),
    ...(userVolumeCache instanceof Map ? { userVolumeCache } : null),
  };

  const entries = await fs.readdir(absoluteDir);

  const filtered = entries
    .filter((name) => !excludedFiles.includes(name))
    .filter((name) =>
      excludeDownloadArtifacts ? path.extname(name).toLowerCase() !== '.download' : true
    );

  const items = await Promise.all(
    filtered.map(async (name) => {
      const filePath = path.join(absoluteDir, name);

      let stats;
      try {
        stats = await fs.stat(filePath);
      } catch (err) {
        if (['EPERM', 'EACCES', 'ENOENT', 'ELOOP'].includes(err?.code)) {
          logger.warn({ filePath, err }, 'Skipping unreadable entry');
          return null;
        }
        throw err;
      }

      const logicalChildPath = combineRelativePath(parentLogicalPath || '', name);
      const childAccess = await getAccessInfo(context, logicalChildPath, accessOptions);
      if (!childAccess?.canAccess) {
        return null;
      }

      const kind = toKind(stats, name);
      const item = {
        name,
        path: parentLogicalPath,
        dateModified: stats.mtime,
        size: stats.size,
        kind,
      };

      if (
        thumbsEnabled &&
        stats.isFile() &&
        kind !== 'pdf' &&
        previewable.has(kind.toLowerCase())
      ) {
        item.supportsThumbnail = true;
      }

      if (typeof itemExtras === 'function') {
        Object.assign(item, itemExtras({ name, stats, kind, access: childAccess }) || {});
      }

      return item;
    })
  );

  return items.filter(Boolean);
};

module.exports = {
  listDirectoryItems,
};

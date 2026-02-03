const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const { collabora, public: publicConfig, mimeTypes } = require('../config/index');
const { normalizeRelativePath } = require('../utils/pathUtils');
const { ensureDir } = require('../utils/fsUtils');
const { resolvePathWithAccess } = require('../services/accessManager');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { getDiscoveryActionsByExt } = require('../services/collaboraDiscoveryService');
const lockService = require('../services/wopiLockService');
const { ValidationError, UnauthorizedError, ForbiddenError } = require('../errors/AppError');

const router = express.Router();

const toExt = (filename = '') => {
  const base = path.basename(String(filename));
  const idx = base.lastIndexOf('.');
  return idx > 0 ? base.slice(idx + 1).toLowerCase() : '';
};

const resolveMime = (ext) => mimeTypes[ext] || 'application/octet-stream';

const toBase64Url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const buildFileId = ({ space, relativePath }) => {
  return toBase64Url(
    crypto
      .createHash('sha256')
      .update(`${space || ''}::${relativePath || ''}`)
      .digest()
  );
};

const getAccessTokenFromReq = (req) => {
  const auth = (req.headers['authorization'] || '').toString();
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  const q = req.query || {};
  if (typeof q.access_token === 'string' && q.access_token) return q.access_token;
  return null;
};

const verifyWopiToken = (req, fileId) => {
  if (!collabora?.secret) {
    throw new UnauthorizedError('COLLABORA_SECRET is not configured.');
  }

  const token = getAccessTokenFromReq(req);
  if (!token) {
    throw new UnauthorizedError('Missing access_token.');
  }

  let payload = null;
  try {
    payload = jwt.verify(token, collabora.secret, { algorithms: ['HS256'] });
  } catch (_e) {
    throw new UnauthorizedError('Invalid access_token.');
  }

  if (!payload || typeof payload !== 'object') {
    throw new UnauthorizedError('Invalid access_token payload.');
  }

  if (payload.fileId !== fileId) {
    throw new UnauthorizedError('access_token fileId mismatch.');
  }

  if (!payload.absolutePath) {
    throw new UnauthorizedError('access_token missing absolutePath.');
  }

  return payload;
};

const versionFromStat = (stat) => {
  // Must change whenever the file changes; use mtime+size.
  return crypto
    .createHash('sha256')
    .update(String(stat.mtimeMs))
    .update(':')
    .update(String(stat.size))
    .digest('hex')
    .slice(0, 20);
};

// POST /api/collabora/config  { path, mode? }
router.post(
  '/collabora/config',
  asyncHandler(async (req, res) => {
    const relativeRaw = req.body?.path || '';
    const mode = (req.body?.mode || 'edit').toLowerCase();

    if (!publicConfig?.url) {
      throw new ValidationError(
        'PUBLIC_URL is required on the server to build absolute URLs for Collabora WOPI.'
      );
    }
    if (!collabora?.url) {
      throw new ValidationError('COLLABORA_URL is not configured on the server.');
    }
    if (!collabora?.secret) {
      throw new ValidationError('COLLABORA_SECRET is not configured on the server.');
    }

    if (typeof relativeRaw !== 'string' || !relativeRaw.trim()) {
      throw new ValidationError('A valid file path is required.');
    }

    const relativePath = normalizeRelativePath(relativeRaw);
    const context = { user: req.user, guestSession: req.guestSession };
    const { accessInfo, resolved } = await resolvePathWithAccess(context, relativePath);

    if (!accessInfo || !accessInfo.canAccess || !accessInfo.canRead) {
      throw new ForbiddenError(accessInfo?.denialReason || 'Access denied.');
    }

    const abs = resolved.absolutePath;
    const stat = await fsp.stat(abs);
    if (stat.isDirectory()) {
      throw new ValidationError('Cannot open a directory in Collabora.');
    }

    const isReadonlyShare = resolved.shareInfo && resolved.shareInfo.accessMode === 'readonly';
    const userCanWrite = Boolean(accessInfo.canWrite) && !isReadonlyShare && mode !== 'view';

    const filename = path.basename(abs);
    const ext = toExt(filename);
    if (!ext) {
      throw new ValidationError('Unknown file extension.');
    }

    const fileId = buildFileId({ space: resolved.space, relativePath: resolved.relativePath });

    const tokenTtlSeconds = 6 * 60 * 60; // 6 hours
    const tokenExpiresAtMs = Date.now() + tokenTtlSeconds * 1000;
    const accessToken = jwt.sign(
      {
        fileId,
        absolutePath: abs,
        logicalPath: resolved.relativePath,
        space: resolved.space,
        canWrite: userCanWrite,
        userId: req.user && req.user.id ? String(req.user.id) : null,
        userName:
          req.user?.displayName || req.user?.username || (req.guestSession ? 'Guest User' : null),
        guestSessionId: req.guestSession?.id || null,
        shareToken: resolved.shareInfo?.shareToken || null,
      },
      collabora.secret,
      {
        algorithm: 'HS256',
        expiresIn: tokenTtlSeconds,
      }
    );

    const actionsByExt = await getDiscoveryActionsByExt();
    const actions = actionsByExt.get(ext);
    if (!actions) {
      throw new ValidationError(`Collabora does not advertise support for .${ext} via discovery.`);
    }

    const actionName = userCanWrite ? 'edit' : 'view';
    const urlTemplate =
      actions[actionName] || actions.default || actions.edit || actions.view || actions.readonly;

    if (!urlTemplate) {
      throw new ValidationError(`Collabora discovery is missing a usable urlsrc for .${ext}.`);
    }

    const wopiSrc = new URL(
      `/api/collabora/wopi/files/${encodeURIComponent(fileId)}`,
      publicConfig.url
    );
    const iframeUrl = new URL(urlTemplate);
    iframeUrl.searchParams.set('WOPISrc', wopiSrc.toString());
    iframeUrl.searchParams.set('access_token', accessToken);
    iframeUrl.searchParams.set('access_token_ttl', String(tokenExpiresAtMs));
    if (collabora.lang) {
      iframeUrl.searchParams.set('lang', collabora.lang);
    }

    res.json({
      urlSrc: iframeUrl.toString(),
      fileId,
      accessToken,
      accessTokenTtl: tokenExpiresAtMs,
    });
  })
);

// WOPI: CheckFileInfo
router.get(
  '/collabora/wopi/files/:fileId',
  asyncHandler(async (req, res) => {
    const fileId = String(req.params?.fileId || '');
    if (!fileId) throw new ValidationError('fileId is required.');

    const tokenPayload = verifyWopiToken(req, fileId);
    const abs = tokenPayload.absolutePath;

    const stat = await fsp.stat(abs);
    if (stat.isDirectory()) throw new ValidationError('Cannot open a directory.');

    const baseName = path.basename(abs);
    const version = versionFromStat(stat);

    res.json({
      BaseFileName: baseName,
      OwnerId: tokenPayload.userId || 'unknown',
      Size: stat.size,
      Version: version,
      UserId: tokenPayload.userId || 'unknown',
      UserFriendlyName: tokenPayload.userName || 'User',
      UserCanWrite: Boolean(tokenPayload.canWrite),
      SupportsUpdate: true,
      SupportsLocks: true,
      SupportsGetLock: true,
      // Required for PostMessage API (enables features like @ mentions)
      PostMessageOrigin: publicConfig?.url || '*',
    });
  })
);

// WOPI: GetFile
router.get(
  '/collabora/wopi/files/:fileId/contents',
  asyncHandler(async (req, res) => {
    const fileId = String(req.params?.fileId || '');
    if (!fileId) throw new ValidationError('fileId is required.');

    const tokenPayload = verifyWopiToken(req, fileId);
    const abs = tokenPayload.absolutePath;

    const stat = await fsp.stat(abs);
    if (stat.isDirectory()) throw new ValidationError('Cannot fetch a directory.');

    const ext = toExt(abs);
    const mime = resolveMime(ext);
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': stat.size,
      'Cache-Control': 'no-store',
      'X-WOPI-ItemVersion': versionFromStat(stat),
    });

    const stream = fs.createReadStream(abs);
    stream.on('error', (e) => {
      logger.error({ err: e }, 'Collabora WOPI GetFile stream failed');
      if (!res.headersSent) res.status(500).end();
      else res.end();
    });
    stream.pipe(res);
  })
);

// WOPI: PutFile (save)
router.post(
  '/collabora/wopi/files/:fileId/contents',
  asyncHandler(async (req, res) => {
    const fileId = String(req.params?.fileId || '');
    if (!fileId) throw new ValidationError('fileId is required.');

    const tokenPayload = verifyWopiToken(req, fileId);
    if (!tokenPayload.canWrite) {
      throw new ForbiddenError('This file is read-only.');
    }

    const abs = tokenPayload.absolutePath;
    await ensureDir(path.dirname(abs));

    const requestLock = (req.headers['x-wopi-lock'] || '').toString();
    const currentLock = lockService.getLock(fileId);
    if (currentLock && (!requestLock || currentLock !== requestLock)) {
      res.setHeader('X-WOPI-Lock', currentLock);
      return res.status(409).end();
    }

    const dir = path.dirname(abs);
    const tmp = path.join(dir, `.${path.basename(abs)}.wopi-tmp-${process.pid}-${Date.now()}`);

    const writeStream = fs.createWriteStream(tmp);
    await new Promise((resolve, reject) => {
      req.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      req.on('error', reject);
    });

    await fsp.rename(tmp, abs);
    const stat = await fsp.stat(abs);

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-WOPI-ItemVersion', versionFromStat(stat));
    return res.status(200).end();
  })
);

// WOPI: Locks
router.post(
  '/collabora/wopi/files/:fileId',
  asyncHandler(async (req, res) => {
    const fileId = String(req.params?.fileId || '');
    if (!fileId) throw new ValidationError('fileId is required.');

    const tokenPayload = verifyWopiToken(req, fileId);
    if (!tokenPayload.canWrite) {
      throw new ForbiddenError('This file is read-only.');
    }

    const override = (req.headers['x-wopi-override'] || '').toString().toUpperCase();
    const lockId = (req.headers['x-wopi-lock'] || '').toString();
    const oldLockId = (req.headers['x-wopi-oldlock'] || '').toString();
    const nowMs = Date.now();

    const conflict = (currentLockId) => {
      if (currentLockId) res.setHeader('X-WOPI-Lock', currentLockId);
      return res.status(409).end();
    };

    if (override === 'GET_LOCK') {
      const current = lockService.getLock(fileId, nowMs);
      if (current) res.setHeader('X-WOPI-Lock', current);
      return res.status(200).end();
    }

    if (!lockId) {
      throw new ValidationError('X-WOPI-Lock is required.');
    }

    if (override === 'LOCK') {
      const result = lockService.tryLock(fileId, lockId, nowMs);
      if (!result.ok) return conflict(result.currentLockId);
      return res.status(200).end();
    }

    if (override === 'UNLOCK') {
      const result = lockService.tryUnlock(fileId, lockId, nowMs);
      if (!result.ok) return conflict(result.currentLockId);
      return res.status(200).end();
    }

    if (override === 'REFRESH_LOCK') {
      const result = lockService.tryRefreshLock(fileId, lockId, nowMs);
      if (!result.ok) return conflict(result.currentLockId);
      return res.status(200).end();
    }

    if (override === 'UNLOCK_AND_RELOCK') {
      if (!oldLockId) throw new ValidationError('X-WOPI-OldLock is required.');
      const result = lockService.tryUnlockAndRelock(fileId, oldLockId, lockId, nowMs);
      if (!result.ok) return conflict(result.currentLockId);
      return res.status(200).end();
    }

    throw new ValidationError(`Unsupported X-WOPI-Override: ${override || '(missing)'}`);
  })
);

module.exports = router;

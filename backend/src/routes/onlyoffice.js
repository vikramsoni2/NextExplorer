const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const { onlyoffice, public: publicConfig, mimeTypes } = require('../config/index');
const { normalizeRelativePath, resolveVolumePath } = require('../utils/pathUtils');
const { ensureDir } = require('../utils/fsUtils');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');
const { ValidationError, UnauthorizedError } = require('../errors/AppError');

const router = express.Router();

// Helpers
const SUPPORTED_TEXT = new Set(['docx', 'doc', 'odt', 'rtf', 'txt']);
const SUPPORTED_SHEET = new Set(['xlsx', 'xls', 'ods', 'csv']);
const SUPPORTED_PRESENTATION = new Set(['pptx', 'ppt', 'odp']);

const toExt = (filename = '') => String(filename).split('.').pop().toLowerCase();

const getDocumentType = (ext) => {
  // ONLYOFFICE expects: 'word' | 'cell' | 'slide'
  if (SUPPORTED_TEXT.has(ext)) return 'word';
  if (SUPPORTED_SHEET.has(ext)) return 'cell';
  if (SUPPORTED_PRESENTATION.has(ext)) return 'slide';
  return 'word';
};

const resolveMime = (ext) => mimeTypes[ext] || 'application/octet-stream';

const getDsJwtFromReq = (req) => {
  const auth = (req.headers['authorization'] || req.headers['authorizationjwt'] || '').toString();
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  const q = req.query || {};
  if (typeof q.token === 'string' && q.token) return q.token;
  if (typeof q.jwt === 'string' && q.jwt) return q.jwt;
  return null;
};

// POST /api/onlyoffice/config  { path, mode? }
router.post('/onlyoffice/config', asyncHandler(async (req, res) => {
  const relativeRaw = req.body?.path || '';
  const mode = (req.body?.mode || 'edit').toLowerCase();

  if (!publicConfig?.url) {
    throw new ValidationError('PUBLIC_URL is required on the server to build absolute URLs for ONLYOFFICE.');
  }
  if (!onlyoffice.serverUrl) {
    throw new ValidationError('ONLYOFFICE_URL is not configured on the server.');
  }

  if (typeof relativeRaw !== 'string' || !relativeRaw.trim()) {
    throw new ValidationError('A valid file path is required.');
  }

  const relativePath = normalizeRelativePath(relativeRaw);
  const abs = resolveVolumePath(relativePath);
  const stat = await fsp.stat(abs);
  if (stat.isDirectory()) {
    throw new ValidationError('Cannot open a directory in ONLYOFFICE.');
  }

    const filename = path.basename(abs);
    const ext = toExt(filename);
    const documentType = getDocumentType(ext);

    const fileUrl = new URL(`/api/onlyoffice/file`, publicConfig.url);
    fileUrl.searchParams.set('path', relativePath);

    const callbackUrl = new URL(`/api/onlyoffice/callback`, publicConfig.url);
    callbackUrl.searchParams.set('path', relativePath);

    // Unique key should change when file changes to bust DS cache
    const key = crypto.createHash('sha256')
      .update(relativePath)
      .update(String(stat.mtimeMs))
      .digest('hex');

    const canEdit = mode !== 'view';

    const config = {
      documentType, // text | spreadsheet | presentation
      type: 'desktop',
      document: {
        fileType: ext,
        key,
        title: filename,
        url: fileUrl.toString(),
        permissions: {
          edit: canEdit,
          download: true,
          print: true,
          review: true,
        },
      },
      editorConfig: {
        mode: canEdit ? 'edit' : 'view',
        callbackUrl: callbackUrl.toString(),
        customization: {
          anonymous: { request: false },
        },
        lang: onlyoffice.lang || 'en',
        // Optionally attach current user info if available
        user: (req.user && req.user.id) ? {
          id: String(req.user.id),
          name: req.user.displayName || req.user.username || 'User',
        } : undefined,
      },
    };

    // Sign config for Document Server when ONLYOFFICE JWT is enabled
    if (onlyoffice.secret) {
      try {
        // Important: sign the final config as-is; do not mutate URLs afterwards
        const token = jwt.sign(config, onlyoffice.secret, { algorithm: 'HS256' });
        config.token = token;
      } catch (e) {
        logger.warn({ err: e }, 'ONLYOFFICE: failed to sign config token');
      }
    }

  res.json({
    documentServerUrl: onlyoffice.serverUrl,
    config,
  });
}));

// GET /api/onlyoffice/file?path=...
router.get('/onlyoffice/file', asyncHandler(async (req, res) => {
  const relativeRaw = req.query?.path || '';
  if (typeof relativeRaw !== 'string' || !relativeRaw.trim()) {
    throw new ValidationError('Path is required.');
  }
  const relativePath = normalizeRelativePath(relativeRaw);
  // Verify DS JWT if configured
  if (onlyoffice.secret) {
    const token = getDsJwtFromReq(req);
    if (!token) {
      throw new UnauthorizedError('Missing token.');
    }
    try {
      jwt.verify(token, onlyoffice.secret, { algorithms: ['HS256'] });
    } catch (e) {
      throw new UnauthorizedError('Invalid token.');
    }
  }

  const abs = resolveVolumePath(relativePath);
  const stat = await fsp.stat(abs);
  if (stat.isDirectory()) {
    throw new ValidationError('Cannot fetch a directory.');
  }
  const ext = toExt(abs);
  const mime = resolveMime(ext);
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': stat.size,
  });
  const stream = fs.createReadStream(abs);
  stream.on('error', (e) => {
    logger.error({ err: e }, 'ONLYOFFICE file stream failed');
    if (!res.headersSent) res.status(500).end();
    else res.end();
  });
  stream.pipe(res);
}));

// POST /api/onlyoffice/callback?path=...
router.post('/onlyoffice/callback', asyncHandler(async (req, res) => {
  try {
    const relativeRaw = req.query?.path || '';
    if (typeof relativeRaw !== 'string' || !relativeRaw.trim()) {
      throw new ValidationError('Path is required.');
    }
    const relativePath = normalizeRelativePath(relativeRaw);
    if (onlyoffice.secret) {
      const token = getDsJwtFromReq(req);
      if (!token) {
        throw new UnauthorizedError('Missing token.');
      }
      try {
        jwt.verify(token, onlyoffice.secret, { algorithms: ['HS256'] });
      } catch (e) {
        throw new UnauthorizedError('Invalid token.');
      }
    }

    const body = req.body || {};
    const status = Number(body.status);
    // See ONLYOFFICE callback statuses: 2 - Save, 6 - Force Save
    if ((status === 2 || status === 6) && body.url) {
      const abs = resolveVolumePath(relativePath);
      await ensureDir(path.dirname(abs));
      // Download updated file from Document Server
      const response = await axios.get(body.url, { responseType: 'stream' });
      await fsp.writeFile(abs, Buffer.from([])); // ensure file exists / truncate
      const writeStream = fs.createWriteStream(abs);
      await new Promise((resolve, reject) => {
        response.data.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
      logger.debug({ path: relativePath }, 'ONLYOFFICE file updated');
      // MUST return {error:0} according to ONLYOFFICE spec
      return res.json({ error: 0 });
    }

    // For other statuses, acknowledge
    return res.json({ error: 0 });
  } catch (err) {
    logger.error({ err }, 'ONLYOFFICE callback failed');
    // Per spec, non-zero error indicates retry; use 1
    return res.status(200).json({ error: 1 });
  }
}));

module.exports = router;

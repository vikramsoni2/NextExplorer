const axios = require('axios');
const { collabora } = require('../config/index');

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

const decodeXmlEntities = (input) => {
  if (!input) return '';
  return String(input)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
};

const parseDiscoveryXml = (xml) => {
  const result = new Map();
  const content = typeof xml === 'string' ? xml : '';

  const actionTagRegex = /<action\b([^>]*?)\/?>/gi;
  let match = null;

  while ((match = actionTagRegex.exec(content))) {
    const attrsRaw = match[1] || '';
    const attrs = {};
    const attrRegex = /([A-Za-z0-9:_-]+)="([^"]*)"/g;
    let a = null;
    while ((a = attrRegex.exec(attrsRaw))) {
      attrs[a[1]] = a[2];
    }

    const ext = (attrs.ext || '').toString().toLowerCase().trim();
    const name = (attrs.name || '').toString().toLowerCase().trim();
    const urlsrc = decodeXmlEntities(attrs.urlsrc || '');

    if (!ext || !urlsrc) continue;

    const existing = result.get(ext) || {};
    if (name) {
      existing[name] = urlsrc;
    } else if (!existing.default) {
      existing.default = urlsrc;
    }
    result.set(ext, existing);
  }

  return result;
};

let cache = {
  fetchedAtMs: 0,
  ttlMs: DEFAULT_TTL_MS,
  actionsByExt: null,
};

const getDiscoveryActionsByExt = async (options = {}) => {
  const now = Date.now();
  const ttlMs = Number.isFinite(options.ttlMs) ? options.ttlMs : cache.ttlMs;

  if (cache.actionsByExt && now - cache.fetchedAtMs < ttlMs) {
    return cache.actionsByExt;
  }

  const discoveryUrl = options.discoveryUrl || collabora?.discoveryUrl;
  if (!discoveryUrl) {
    throw new Error('COLLABORA_DISCOVERY_URL is not configured.');
  }

  const response = await axios.get(discoveryUrl, {
    responseType: 'text',
    timeout: 10_000,
    maxContentLength: 5 * 1024 * 1024,
    validateStatus: (s) => s >= 200 && s < 300,
  });

  const actionsByExt = parseDiscoveryXml(response.data);
  cache = { fetchedAtMs: now, ttlMs, actionsByExt };
  return actionsByExt;
};

module.exports = {
  getDiscoveryActionsByExt,
  parseDiscoveryXml,
};

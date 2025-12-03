const logger = require('../utils/logger');

const discoveryCache = new Map();
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

const normalizeIssuer = (issuer) => {
  if (typeof issuer !== 'string' || !issuer.trim()) return null;
  const trimmed = issuer.trim();
  return trimmed.endsWith('/') ? trimmed.replace(/\/+$/, '') : trimmed;
};

const buildDiscoveryUrl = (issuer) => {
  const normalized = normalizeIssuer(issuer);
  if (!normalized) return null;
  return `${normalized}/.well-known/openid-configuration`;
};

const fetchJson = async (url, { timeoutMs = 5000, headers = {}, method = 'GET' } = {}) => {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const id = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...headers,
      },
      signal: controller ? controller.signal : undefined,
    });

    if (!response.ok) {
      const err = new Error(`Failed request to ${url}: ${response.status} ${response.statusText}`);
      err.status = response.status;
      throw err;
    }

    return await response.json();
  } finally {
    if (id) clearTimeout(id);
  }
};

const discoverOpenIdConfiguration = async ({ issuer, forceRefresh = false, timeoutMs = 5000 } = {}) => {
  logger.debug({ issuer, forceRefresh, timeoutMs }, 'Starting OIDC configuration discovery');
  
  const normalized = normalizeIssuer(issuer);
  if (!normalized) {
    logger.debug({ issuer }, 'Invalid issuer URL provided');
    return null;
  }

  const cacheEntry = discoveryCache.get(normalized);
  if (!forceRefresh && cacheEntry && cacheEntry.expiresAt > Date.now()) {
    logger.debug({ issuer: normalized }, 'Using cached OIDC configuration');
    return cacheEntry.configuration;
  }

  const url = buildDiscoveryUrl(normalized);
  if (!url) {
    logger.debug({ issuer: normalized }, 'Failed to build discovery URL');
    return null;
  }
  
  logger.debug({ url }, 'Fetching OIDC configuration');

  const configuration = await fetchJson(url, { timeoutMs });
  if (!configuration || typeof configuration !== 'object') {
    return null;
  }

  const ttlMs = Number(configuration.configuration_ttl || DEFAULT_TTL_MS);
  const expiresAt = Date.now() + (Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : DEFAULT_TTL_MS);

  discoveryCache.set(normalized, { configuration, expiresAt });
  return configuration;
};

const fetchUserInfoClaims = async ({ issuer, accessToken, userInfoURL = null, timeoutMs = 5000 } = {}) => {
  logger.debug({ issuer, timeoutMs, hasOverride: Boolean(userInfoURL) }, 'Starting userinfo claims fetch');
  
  if (!issuer || !accessToken) {
    logger.debug({ issuer: !!issuer, hasToken: !!accessToken }, 'Missing required parameters for userinfo fetch');
    return null;
  }

  // Prefer explicit override when provided and valid
  let endpoint = null;
  if (userInfoURL) {
    try {
      const u = new URL(userInfoURL);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        endpoint = u.href;
        logger.debug({ endpoint }, 'Using overridden OIDC userinfo URL');
      }
    } catch (e) {
      logger.warn({ err: e, userInfoURL }, 'Invalid OIDC userinfo override URL provided');
    }
  }

  // Fall back to discovery when no valid override was provided
  if (!endpoint) {
    const configuration = await discoverOpenIdConfiguration({ issuer, timeoutMs });
    logger.debug({ issuer, hasConfiguration: Boolean(configuration) }, 'Received OIDC configuration');
    endpoint = configuration && configuration.userinfo_endpoint ? configuration.userinfo_endpoint : null;
  }

  if (!endpoint) {
    logger.warn({ issuer }, 'No userinfo endpoint available (override or discovery)');
    return null;
  }
  
  logger.debug({ endpoint }, 'Fetching user info from endpoint');

  try {
    return await fetchJson(endpoint, {
      timeoutMs,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    logger.warn({ err: error, issuer }, 'Failed to fetch OIDC userinfo');
    return null;
  }
};

module.exports = {
  discoverOpenIdConfiguration,
  fetchUserInfoClaims,
  normalizeIssuer,
};

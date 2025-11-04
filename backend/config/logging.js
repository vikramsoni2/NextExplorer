const { normalizeBoolean } = require('../utils/env');

const supportedLevels = new Set(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']);

const sanitizeLevel = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return supportedLevels.has(normalized) ? normalized : null;
};

const resolvedLogLevel =
  sanitizeLevel(process.env.LOG_LEVEL) ||
  (normalizeBoolean(process.env.DEBUG) === true ? 'debug' : 'info');

const isDebugLevel = resolvedLogLevel === 'debug' || resolvedLogLevel === 'trace';

module.exports = {
  level: resolvedLogLevel,
  isDebug: isDebugLevel,
  enableHttpLogging: isDebugLevel,
};

const { normalizeRelativePath } = require('../utils/pathUtils');
const { getSettings, setSettings } = require('../services/settingsService');

// Determine permission for a given relative path: 'rw' | 'ro' | 'hidden'
const getPermissionForPath = async (relativePath) => {
  const rel = normalizeRelativePath(relativePath || '');
  const settings = await getSettings();
  const rules = Array.isArray(settings?.access?.rules)
    ? settings.access.rules
    : [];

  // first match wins
  for (const rule of rules) {
    const rulePath = normalizeRelativePath(rule.path || '');
    if (!rulePath) continue;

    if (rule.recursive) {
      if (rel === rulePath || rel.startsWith(rulePath + '/')) {
        return rule.permissions || 'rw';
      }
    } else {
      if (rel === rulePath) {
        return rule.permissions || 'rw';
      }
    }
  }

  return 'rw';
};

const getRules = async () => {
  const settings = await getSettings();
  return Array.isArray(settings?.access?.rules) ? settings.access.rules : [];
};

const setRules = async (rules) => {
  const next = await setSettings({
    access: {
      rules: Array.isArray(rules) ? rules : [],
    },
  });
  return next.access.rules;
};

module.exports = {
  getPermissionForPath,
  getRules,
  setRules,
};

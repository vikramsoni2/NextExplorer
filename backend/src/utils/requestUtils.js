const readMetaField = (req, key, fallback = '') => {
  if (!req || !req.body) return fallback;

  if (typeof req.body[key] === 'string') {
    return req.body[key];
  }

  const bracketKey = `meta[${key}]`;
  const bracketValue = req.body[bracketKey];
  if (typeof bracketValue === 'string') {
    return bracketValue;
  }

  return fallback;
};

module.exports = {
  readMetaField,
};

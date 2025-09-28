const extractBearerToken = (authorizationHeader) => {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') {
    return null;
  }

  const [scheme, value] = authorizationHeader.split(' ');
  if (!value || !/^Bearer$/i.test(scheme)) {
    return null;
  }

  return value.trim() || null;
};

const extractToken = (req) => {
  const headerToken = extractBearerToken(req.headers?.authorization);
  if (headerToken) {
    return headerToken;
  }

  const customHeaderToken = req.headers?.['x-access-token'];
  if (customHeaderToken && typeof customHeaderToken === 'string') {
    const trimmed = customHeaderToken.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  const queryToken = req.query?.token;
  if (typeof queryToken === 'string' && queryToken.trim()) {
    return queryToken.trim();
  }

  const bodyToken = req.body?.token;
  if (typeof bodyToken === 'string' && bodyToken.trim()) {
    return bodyToken.trim();
  }

  return null;
};

module.exports = {
  extractToken,
};

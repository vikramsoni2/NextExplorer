/**
 * Calculate expiration date from user's default share expiration setting
 * @param {Object|null} defaultExpiration - User's default expiration setting: { value: number, unit: 'days'|'weeks'|'months' } or null
 * @returns {Date|null} Calculated expiration date or null if no default is set
 */
export function calculateExpirationDate(defaultExpiration) {
  if (!defaultExpiration || typeof defaultExpiration !== 'object' || !defaultExpiration.value) {
    return null;
  }

  const now = new Date();
  const expirationDate = new Date(now);

  switch (defaultExpiration.unit) {
    case 'days':
      expirationDate.setDate(now.getDate() + defaultExpiration.value);
      break;
    case 'weeks':
      expirationDate.setDate(now.getDate() + defaultExpiration.value * 7);
      break;
    case 'months':
      expirationDate.setMonth(now.getMonth() + defaultExpiration.value);
      break;
    default:
      return null;
  }

  return expirationDate;
}

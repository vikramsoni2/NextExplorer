// Utility to truncate long strings with a middle ellipsis.
// Example: truncateMiddle('verylongfoldername', 12) => 'verylo…rname'
// Options:
// - ellipsis: string to use between parts (default: '…')
// - keepStart: number of chars to keep from start
// - keepEnd: number of chars to keep from end
export function ellipses(input, max = 30, options = {}) {
  if (input == null) return '';
  const str = String(input);
  const { ellipsis = '…', keepStart, keepEnd } = options;

  if (max <= 0) return '';
  if (str.length <= max) return str;

  const ellipsisLen = ellipsis.length;
  if (max <= ellipsisLen) return ellipsis.slice(0, max);

  let startLen = typeof keepStart === 'number' ? keepStart : Math.ceil((max - ellipsisLen) * 0.6);
  let endLen = typeof keepEnd === 'number' ? keepEnd : (max - ellipsisLen - startLen);

  if (startLen < 0) startLen = 0;
  if (endLen < 0) endLen = 0;

  const start = str.slice(0, startLen);
  const end = str.slice(str.length - endLen);
  return `${start}${ellipsis}${end}`;
}


export const isMac =
  typeof navigator !== 'undefined'
    ? /Mac|iPhone|iPod|iPad/.test(navigator.platform || '')
    : false;

export const modKeyLabel = isMac ? '⌘' : 'Ctrl';

// Platform-aware label for the delete/backspace key shown in UI hints.
// Use the backspace symbol on macOS and 'Del' elsewhere.
export const deleteKeyLabel = isMac ? '⌫' : 'Del';

import { inject } from 'vue';

export const explorerContextMenuSymbol = Symbol('ExplorerContextMenu');

export function useExplorerContextMenu(options = {}) {
  const context = inject(explorerContextMenuSymbol, null);
  if (!context && options.required) {
    throw new Error(
      'Explorer context menu is not available. Wrap content with <ExplorerContextMenu>.',
    );
  }
  return context;
}

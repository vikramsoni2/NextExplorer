import { computed } from 'vue';
import { useSettingsStore } from '@/stores/settings';

/**
 * Composable for centralized view mode configuration
 * Provides grid classes, styles, and shared constants for different view modes
 */
export function useViewConfig() {
  const settings = useSettingsStore();

  /**
   * Compute grid container classes based on current view mode
   */
  const gridClasses = computed(() => {
    switch (settings.view) {
      case 'grid':
        // Use auto-fill so a small number of items don't stretch to full row width.
        // Empty tracks still participate in layout, keeping item widths consistent.
        return 'grid content-start items-start grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-2';
      case 'tab':
        return 'grid content-start items-start grid-cols-[repeat(auto-fill,20rem)] gap-2';
      case 'photos':
        return 'grid content-start items-start gap-1 md:gap-2';
      case 'list':
      default:
        return 'flex flex-col gap-0.5';
    }
  });

  /**
   * Compute inline styles for grid container (used for photos view dynamic sizing)
   */
  const gridStyle = computed(() => {
    if (settings.view === 'photos') {
      return {
        gridTemplateColumns: `repeat(auto-fill, minmax(${settings.photoSize}px, 1fr))`,
      };
    }
    return undefined;
  });

  return {
    gridClasses,
    gridStyle,
  };
}

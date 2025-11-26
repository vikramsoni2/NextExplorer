import { ref } from 'vue';
import { useFavoritesStore } from '@/stores/favorites';

// Singleton instance so multiple callers share the same modal state
let instance = null;

export function useFavoriteEditor() {
  if (instance) return instance;

  const favoritesStore = useFavoritesStore();

  const isFavoriteEditorOpen = ref(false);
  const currentFavorite = ref(null);
  const editorName = ref('');
  const editorPath = ref('');
  const editorIcon = ref('');
  const editorIconVariant = ref('outline-solid');
  const editorColor = ref(null);
  const isSaving = ref(false);

  const openEditorForFavorite = (favorite) => {
    if (!favorite || !favorite.path) return;
    currentFavorite.value = favorite;
    editorPath.value = favorite.path || '';
    const autoName = favorite.path.split('/').pop() || favorite.path;
    editorName.value = favorite.label || autoName;

    // Parse icon to extract variant and icon name
    const iconStr = favorite.icon || 'outline:StarIcon';
    if (iconStr.includes(':')) {
      const [variant, iconName] = iconStr.split(':', 2);
      editorIconVariant.value = variant.toLowerCase();
      editorIcon.value = iconName.trim();
    } else {
      editorIconVariant.value = 'outline-solid';
      editorIcon.value = iconStr;
    }

    editorColor.value = favorite.color || null;
    isFavoriteEditorOpen.value = true;
  };

  const closeFavoriteEditor = () => {
    isFavoriteEditorOpen.value = false;
    currentFavorite.value = null;
  };

  const saveFavoriteEditor = async () => {
    if (!currentFavorite.value || !currentFavorite.value.id || isSaving.value) {
      closeFavoriteEditor();
      return;
    }

    isSaving.value = true;
    try {
      // Combine variant and icon name
      const iconValue = `${editorIconVariant.value}:${editorIcon.value}`;

      await favoritesStore.updateFavorite(currentFavorite.value.id, {
        label: editorName.value,
        icon: iconValue,
        color: editorColor.value,
      });
    } catch (err) {
      console.error('Failed to update favorite', err);
    } finally {
      isSaving.value = false;
      closeFavoriteEditor();
    }
  };

  instance = {
    isFavoriteEditorOpen,
    currentFavorite,
    editorName,
    editorPath,
    editorIcon,
    editorIconVariant,
    editorColor,
    isSaving,
    openEditorForFavorite,
    closeFavoriteEditor,
    saveFavoriteEditor,
  };

  return instance;
}

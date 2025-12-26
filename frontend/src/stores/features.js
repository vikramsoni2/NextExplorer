import { defineStore } from 'pinia';
import { ref } from 'vue';
import { fetchFeatures } from '@/api';

export const useFeaturesStore = defineStore('features', () => {
  const editorExtensions = ref([]);
  const onlyofficeEnabled = ref(false);
  const onlyofficeExtensions = ref([]);
  const volumeUsageEnabled = ref(false);
  const personalEnabled = ref(false);
  const userVolumesEnabled = ref(false);
  const skipHome = ref(false);
  const version = ref('');
  const gitCommit = ref('');
  const gitBranch = ref('');
  const repoUrl = ref('');
  const isLoading = ref(false);
  const hasLoaded = ref(false);
  let initPromise = null;

  const initialize = async () => {
    if (initPromise) {
      return initPromise;
    }

    initPromise = (async () => {
      if (hasLoaded.value) {
        return;
      }

      isLoading.value = true;

      try {
        const features = await fetchFeatures();

        // Editor extensions
        editorExtensions.value = Array.isArray(features?.editor?.extensions)
          ? features.editor.extensions
          : [];

        // OnlyOffice
        onlyofficeEnabled.value = Boolean(features?.onlyoffice?.enabled);
        onlyofficeExtensions.value = Array.isArray(
          features?.onlyoffice?.extensions,
        )
          ? features.onlyoffice.extensions
          : [];

        // Volume usage
        volumeUsageEnabled.value = Boolean(features?.volumeUsage?.enabled);

        // Personal folders
        personalEnabled.value = Boolean(features?.personal?.enabled);

        // User volumes (per-user volume assignments)
        userVolumesEnabled.value = Boolean(features?.userVolumes?.enabled);

        // Navigation behavior
        skipHome.value = Boolean(features?.navigation?.skipHome);

        // Version information
        version.value = features?.version?.app || '';
        gitCommit.value = features?.version?.gitCommit || '';
        gitBranch.value = features?.version?.gitBranch || '';
        repoUrl.value = features?.version?.repoUrl || '';

        hasLoaded.value = true;
      } catch (error) {
        console.error('Failed to load features:', error);
        // Set defaults on error
        editorExtensions.value = [];
        onlyofficeEnabled.value = false;
        onlyofficeExtensions.value = [];
        volumeUsageEnabled.value = false;
        personalEnabled.value = false;
        userVolumesEnabled.value = false;
        skipHome.value = false;
      } finally {
        isLoading.value = false;
      }
    })();

    return initPromise;
  };

  const ensureLoaded = async () => {
    if (!hasLoaded.value && !isLoading.value) {
      await initialize();
    }
    if (initPromise) {
      await initPromise;
    }
  };

  return {
    editorExtensions,
    onlyofficeEnabled,
    onlyofficeExtensions,
    volumeUsageEnabled,
    personalEnabled,
    userVolumesEnabled,
    skipHome,
    version,
    gitCommit,
    gitBranch,
    repoUrl,
    isLoading,
    hasLoaded,
    initialize,
    ensureLoaded,
  };
});

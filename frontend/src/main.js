import './assets/main.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';
import { installPreviewPlugins } from '@/plugins';
import { useFeaturesStore } from '@/stores/features';
import { useAppSettings } from '@/stores/appSettings';
import i18n from './i18n';

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);

const featuresStore = useFeaturesStore(pinia);
featuresStore.initialize().catch((err) => {
  console.debug('Failed to load features at startup:', err);
});

// Initialize app settings - load public branding first (works on login page)
const appSettings = useAppSettings(pinia);
appSettings.loadBranding().catch((err) => {
  console.debug('Failed to load branding at startup:', err);
});

// After authentication, the full settings (thumbnails, access rules) will be loaded
// This happens in the router guard or after successful login

// Install preview plugins
// Option 1: Basic usage (installs all core + ONLYOFFICE)
installPreviewPlugins(pinia);

// Option 2: With custom plugins
// import { myCustomPlugin } from './plugins/custom/myCustomPlugin'
// installPreviewPlugins(pinia, {
//   plugins: [myCustomPlugin()],
// })

// Option 3: Skip ONLYOFFICE (faster startup)
// installPreviewPlugins(pinia, { skipOnlyOffice: true })

app.use(router);
app.use(i18n);

app.mount('#app');

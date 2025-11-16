import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { installPreviewPlugins } from '@/plugins';
import { useFeaturesStore } from '@/stores/features';
import i18n from './i18n'

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)

const featuresStore = useFeaturesStore(pinia)
featuresStore.initialize().catch(err => {
  console.debug('Failed to load features at startup:', err)
})

// Install preview plugins
// Option 1: Basic usage (installs all core + ONLYOFFICE)
installPreviewPlugins(pinia)

// Option 2: With custom plugins
// import { myCustomPlugin } from './plugins/custom/myCustomPlugin'
// installPreviewPlugins(pinia, {
//   plugins: [myCustomPlugin()],
// })

// Option 3: Skip ONLYOFFICE (faster startup)
// installPreviewPlugins(pinia, { skipOnlyOffice: true })

app.use(router)
app.use(i18n)

app.mount('#app')

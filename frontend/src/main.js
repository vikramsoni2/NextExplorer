import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { installPreviewPlugins } from '@/plugins';

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
installPreviewPlugins(pinia)
app.use(router)

app.mount('#app')

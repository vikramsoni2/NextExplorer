import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueDevTools from 'vite-plugin-vue-devtools'

const backendOrigin = process.env.VITE_BACKEND_ORIGIN || 'http://localhost:3001'
const port = Number(process.env.PORT || 3000)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VueDevTools(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || process.env.npm_package_version || '1.0.5'),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0',
    port,
    strictPort: true,
    proxy: {
      '/api': { target: backendOrigin, changeOrigin: true, ws: true, secure: false },
      '/static/thumbnails': { target: backendOrigin, changeOrigin: true, secure: false },
    }
  }
 
})

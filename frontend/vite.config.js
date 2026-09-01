import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      // The API must always hit the network — never let the service worker
      // cache auth/data responses, only the static app shell.
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'تناسب — باشگاه هوشمند',
        short_name: 'تناسب',
        description: 'پلتفرم مدیریت باشگاه‌های ورزشی تناسب',
        lang: 'fa',
        dir: 'rtl',
        start_url: '/',
        display: 'standalone',
        background_color: '#0e1117',
        theme_color: '#2496ed',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      // User-uploaded files (editor images, class covers, blog art) live on
      // Django. Without this, Vite's SPA fallback answers /media/* with
      // index.html and every uploaded image renders broken in dev — in
      // production nginx proxies /media/ and it works, so the bug only ever
      // shows up locally.
      '/media': 'http://127.0.0.1:8000',
    },
  },
})

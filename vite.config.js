// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // atualiza sozinho
      includeAssets: ['favicon.svg', 'robots.txt'],
      devOptions: { enabled: true },
      manifest: {
        name: 'TPM – Manutenção',
        short_name: 'TPM',
        description: 'Painel de Manutenção (PWA)',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#111827',
        background_color: '#ffffff',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable any' }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // não cacheia firestore / google apis
            urlPattern: ({ url }) =>
              url.host.includes('googleapis.com') ||
              url.host.includes('gstatic.com') ||
              url.pathname.includes('/google.firestore.v1.Firestore/'),
            handler: 'NetworkOnly',
            method: 'GET',
          },
          {
            // páginas HTML
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'html-pages' }
          },
          {
            // js/css/workers locais
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && ['style', 'script', 'worker'].includes(request.destination),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'static-assets' }
          },
          {
            // imagens
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'images' }
          }
        ]
      }
    })
  ]
})

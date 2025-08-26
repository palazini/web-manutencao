// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'robots.txt',
        'apple-touch-icon.png'
      ],
      devOptions: { enabled: true },
      manifest: {
        name: 'TPM – Manutenção',
        short_name: 'TPM',
        description: 'Painel de Manutenção (PWA)',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#111827',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp}'],
        navigateFallback: '/index.html', // SPA fallback
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // até 6 MiB
        runtimeCaching: [
          // Firestore API
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-firestore',
              networkTimeoutSeconds: 8
            }
          },
          // Firebase Storage
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-storage',
              networkTimeoutSeconds: 8
            }
          },
          // bloqueia googleapis/gstatic gerais (ex: auth, sdk)
          {
            urlPattern: ({ url }) =>
              url.host.includes('googleapis.com') ||
              url.host.includes('gstatic.com'),
            handler: 'NetworkOnly'
          },
          // páginas HTML navegadas
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'html-pages' }
          },
          // js/css/workers locais
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && ['style', 'script', 'worker'].includes(request.destination),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'static-assets' }
          },
          // imagens
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'images' }
          }
        ]
      }
    })
  ]
})

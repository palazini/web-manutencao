// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',      // mostra aviso de atualização
      includeAssets: ['favicon.svg', 'robots.txt'],
      devOptions: { enabled: true }, // permite testar no dev
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Evita cachear streams/long-poll do Firestore e endpoints do Firebase
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.host.includes('googleapis.com') ||
              url.host.includes('gstatic.com') ||
              url.pathname.includes('/google.firestore.v1.Firestore/'),
            handler: 'NetworkOnly',
            method: 'GET',
          },
          {
            // navegação (HTML) => NetworkFirst (funciona offline com fallback)
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'html-pages' }
          },
          {
            // assets estáticos => SWR
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
        ],
      },
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
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      }
    })
  ]
})

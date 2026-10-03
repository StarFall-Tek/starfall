import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Bump injectManifest/cache via workbox; SW filename stays sw.js (Lucifer pattern).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      filename: 'sw.js',
      manifestFilename: 'manifest.webmanifest',
      includeAssets: [
        'favicon.ico',
        'favicon.png',
        'apple-touch-icon.png',
        'starfall-logo.png',
        'starfall-icon.png',
        'starfall-icon-180.png',
        'icon-192.png',
        'icon-512.png',
        'icon-512-maskable.png',
        'starfall-hero-original.jpg',
        'starfall-mark.png',
      ],
      // Prefer public/manifest.webmanifest shape; plugin merges/writes to dist
      manifest: {
        name: 'STARFALL-TEK',
        short_name: 'STARFALL',
        description:
          'Paper-first crypto desk for Christopher Loeb. Not financial advice.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#050814',
        theme_color: '#050814',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        categories: ['finance', 'utilities'],
      },
      workbox: {
        // Never forever-cache API/price responses — exclude from precache
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/scout\//, /^\/\.netlify\//],
        runtimeCaching: [
          {
            // HTML / navigation — network-first (Lucifer tip)
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'starfall-html-v1',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Static css/js/png — cache-first
            urlPattern: ({ request }) =>
              ['style', 'script', 'image', 'font'].includes(request.destination),
            handler: 'CacheFirst',
            options: {
              cacheName: 'starfall-static-v1',
              expiration: {
                maxEntries: 64,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            // Future public price APIs — network-only (never forever-cache)
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/') ||
              url.pathname.startsWith('/scout/') ||
              /coingecko|binance|coinbase|cryptocompare/i.test(url.hostname),
            handler: 'NetworkOnly',
          },
        ],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})

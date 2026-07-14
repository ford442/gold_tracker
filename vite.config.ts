/// <reference types="vitest/config" />
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  // Relative base for subdirectory deploy (e.g. test.1ink.us/gold/) — no post-build sed rewrites.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'vite.svg'],
      manifest: {
        name: 'GoldTrackr',
        short_name: 'GoldTrackr',
        description: 'Real-time gold & crypto dashboard — PAXG, XAUT, BTC, ETH',
        theme_color: '#0a0c14',
        background_color: '#0a0c14',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
      '@lib': path.resolve(rootDir, 'src/lib'),
      '@components': path.resolve(rootDir, 'src/components'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        // manualChunks groups — see AGENTS.md "Bundle / code splitting".
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/') ||
            id.includes('/react-is/')
          ) {
            return 'react-vendor';
          }
          if (
            id.includes('/recharts/') ||
            id.includes('/d3-') ||
            id.includes('/victory-vendor/')
          ) {
            return 'recharts';
          }
          if (id.includes('/@supabase/')) {
            return 'supabase';
          }
          if (id.includes('/jose/')) {
            return 'jose';
          }
        },
      },
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Pure math / strategy modules only — API clients (api.ts, coinbase.ts, supabase.ts) are out of scope.
      include: [
        'src/lib/utils.ts',
        'src/lib/regime.ts',
        'src/lib/strategyEngine.ts',
        'src/lib/krakenApi.ts',
        'src/lib/metalprice.ts',
        'src/lib/assets.ts',
        'src/lib/fiscalYear.ts',
        'src/lib/alertRules.ts',
        'src/lib/paperTrade.ts',
        'src/lib/exchanges.ts',
        'src/lib/marketCache.ts',
        'src/lib/portfolioLots.ts',
      ],
      exclude: ['src/lib/**/*.test.ts'],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
})

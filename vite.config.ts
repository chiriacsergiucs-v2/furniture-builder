import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.BASE_PATH ?? '/furniture-builder/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Furniture Builder', short_name: 'Furniture',
        description: 'Parametric furniture designer with 3D preview and cut list. Works offline.',
        display: 'standalone', theme_color: '#1d1f1c', background_color: '#f4f2ec',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 },
    }),
  ],
  // three.js is ~1 MB and lazy-loaded on demand (ADR-0013).
  build: { chunkSizeWarningLimit: 1100 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})

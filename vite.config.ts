import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/furniture-builder/',
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    injectRegister: 'auto',
    includeAssets: ['favicon.svg'],
    manifest: {
      name: 'Mobila Cutlist Optimizer', short_name: 'Cutlist',
      description: 'Offline furniture panel guillotine cutting optimizer',
      start_url: '/furniture-builder/', scope: '/furniture-builder/',
      display: 'standalone', theme_color: '#173452', background_color: '#f6f8fb',
      icons: [
        {src: 'icons/app-192.png', sizes: '192x192', type: 'image/png'},
        {src: 'icons/app-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable'}
      ]
    },
    workbox: {maximumFileSizeToCacheInBytes: 8*1024*1024, navigateFallback: 'index.html', globPatterns: ['**/*.{js,css,html,svg,png,woff2}']}
  })],
  test: {environment:'node', include:['src/tests/unit/**/*.test.ts']}
})

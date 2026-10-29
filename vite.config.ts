import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { loadEnv, type Plugin } from 'vite';
import { contentSecurityPolicy } from './csp';

/** The CSP meta tag (ADR-131), first in <head>, with this build's backend origin. */
const csp = (mode: string): Plugin => ({
  name: 'furniture-builder-csp',
  transformIndexHtml: (html) =>
    html.replace(
      '<meta charset="UTF-8" />',
      `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(
        loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL,
      )}" />`,
    ),
});

export default defineConfig(({ mode }) => ({
  base: process.env.BASE_PATH ?? '/furniture-builder/',
  plugins: [
    react(),
    csp(mode),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Furniture Builder',
        short_name: 'Furniture',
        description: 'Parametric furniture designer with 3D preview and cut list. Works offline.',
        display: 'standalone',
        theme_color: '#1d1f1c',
        background_color: '#f4f2ec',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  // three.js is ~1 MB and lazy-loaded on demand (ADR-013).
  build: { chunkSizeWarningLimit: 1100 },
  // Find-it tests (tests/find-it, ADR-108) walk the whole app in jsdom and need longer than the default 5 s.
  test: { environment: 'node', include: ['tests/**/*.test.{ts,tsx}'], testTimeout: 30000 },
}));

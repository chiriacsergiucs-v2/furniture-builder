import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { loadEnv, type Plugin } from 'vite';
import { contentSecurityPolicy } from './csp';

/** Libraries in a chunk of their own (ADR-222): the 3D engine, its React renderer, IndexedDB and the account backend. */
const VENDOR_CHUNKS: [RegExp, string][] = [
  [/[\\/]node_modules[\\/]three[\\/]/, 'three'],
  [/[\\/]node_modules[\\/]@react-three[\\/]/, 'react-three'],
  [/[\\/]node_modules[\\/]dexie[\\/]/, 'dexie'],
  [/[\\/]node_modules[\\/]@supabase[\\/]/, 'supabase'],
  // The shipped research papers, reached only through `import()` (researchStore).
  [
    /[\\/]src[\\/]core[\\/]research[\\/](index|ensemble-[^/\\]*(?<!\.app))\.ts$|[\\/]docs[\\/]research[\\/]/,
    'research',
  ],
];

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
  build: {
    chunkSizeWarningLimit: 1100,
    // Named chunks for the large libraries (ADR-222), so a static import cannot pull them into `index` unnoticed
    // (tests/bundle-boundary.test.ts).
    rollupOptions: {
      output: {
        manualChunks: (id: string) => VENDOR_CHUNKS.find(([re]) => re.test(id))?.[1],
        // The lazy Russian dictionary (ADR-229) is its own chunk; name it so only the entry is called `index-*`.
        chunkFileNames: (chunk) =>
          chunk.facadeModuleId?.endsWith('/src/core/i18n/ru/index.ts')
            ? 'assets/i18n-ru-[hash].js'
            : 'assets/[name]-[hash].js',
        // Only the modules named above go in those chunks: their shared dependencies (React, the i18n tables) stay
        // where Rollup would put them, or `index` would import the 3D chunks statically.
        onlyExplicitManualChunks: true,
      },
    },
  },
  // Find-it tests (tests/find-it, ADR-108) walk the whole app in jsdom and need longer than the default 5 s.
  test: { environment: 'node', include: ['tests/**/*.test.{ts,tsx}'], testTimeout: 30000 },
}));

// ADR-222: the first-paint `index` chunk stays free of the 3D engine, the account backend and the research data, and
// under a byte budget. It reads the production build in `dist/assets`, so it runs after `pnpm build` (the CI `build`
// job runs it after `pnpm build:ci` with REQUIRE_DIST=1, which turns a missing `dist` into a failure).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ASSETS = join(__dirname, '..', 'dist', 'assets');
const built = existsSync(ASSETS);

/**
 * Raw bytes of the `index` chunk measured 2026-11-07 after ADR-222 (`pnpm build`), + 2 %. Before ADR-222 it was
 * 2 677 213 bytes (800 KB gzip).
 */
const INDEX_BUDGET = Math.round(1_884_648 * 1.02);

describe('ADR-222 bundle boundary', () => {
  it.skipIf(built || !process.env.REQUIRE_DIST)('dist is required here', () => {
    throw new Error('dist/assets is missing: run pnpm build first');
  });
  it.skipIf(!built)(built ? 'reads dist/assets' : 'skipped: run pnpm build first', () => {
    const files = readdirSync(ASSETS);
    const index = files.filter((f) => /^index-.*\.js$/.test(f));
    expect(index).toHaveLength(1);
    const code = readFileSync(join(ASSETS, index[0]), 'utf8');
    expect(code.includes('WebGLRenderer'), 'three.js in index').toBe(false);
    expect(code.includes('createClient'), 'the Supabase client in index').toBe(false);
    expect(code.includes('"ens-2026-10-23"'), 'research data in index').toBe(false);
    expect(statSync(join(ASSETS, index[0])).size).toBeLessThanOrEqual(INDEX_BUDGET);
    // No static import of the 3D chunks: `index` may only name them for a later `import()`.
    expect(code, 'a static import of a 3D chunk').not.toMatch(
      /(from|import)"\.\/(three|react-three)-/,
    );
    // The named chunks of `manualChunks` (vite.config.ts).
    for (const name of ['three', 'react-three', 'dexie', 'research'])
      expect(
        files.some((f) => f.startsWith(`${name}-`) && f.endsWith('.js')),
        `${name} chunk`,
      ).toBe(true);
  });
});

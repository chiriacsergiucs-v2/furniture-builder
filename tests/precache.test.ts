// ADR-234: offline before first use (ADR-002, ADR-161) is a tested promise. The service worker's precache manifest in
// `dist/sw.js` lists the app shell, the seller catalog and the 3D viewer chunks, and its total stays under a budget so
// the precache only grows on purpose. It reads the production build, so it runs after `pnpm build` (the CI `build` job
// runs it after `pnpm build:ci` with REQUIRE_DIST=1, which turns a missing `dist` into a failure).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIST = join(__dirname, '..', 'dist');
const SW = join(DIST, 'sw.js');
const built = existsSync(SW);

/**
 * Total bytes of every precached file, measured 2026-11-07 when ADR-234 was built (`pnpm build`, after ADR-222):
 * 160 entries, 8 625 254 bytes, + 10 %. Raising it is a reviewed one-line change.
 */
const PRECACHE_BUDGET = Math.round(8_625_254 * 1.1);

describe('ADR-234 precache', () => {
  it.skipIf(built || !process.env.REQUIRE_DIST)('dist is required here', () => {
    throw new Error('dist/sw.js is missing: run pnpm build first');
  });
  it.skipIf(!built)(built ? 'reads dist/sw.js' : 'skipped: run pnpm build first', () => {
    const urls = [...readFileSync(SW, 'utf8').matchAll(/\burl:"([^"]+)"/g)].map((m) => m[1]);
    const listed = (re: RegExp, what: string) =>
      expect(
        urls.some((u) => re.test(u)),
        `${what} is precached`,
      ).toBe(true);
    listed(/^index\.html$/, 'index.html');
    listed(/^assets\/index-[^/]*\.js$/, 'the index chunk');
    listed(/^assets\/index-[^/]*\.css$/, 'the CSS');
    listed(/^assets\/regency-[^/]*\.js$/, 'the seller catalog');
    listed(/^assets\/Viewer3D-[^/]*\.js$/, 'the 3D viewer');
    listed(/^assets\/three-[^/]*\.js$/, 'three.js');
    listed(/^assets\/react-three-[^/]*\.js$/, '@react-three');
    let total = 0;
    for (const u of urls) total += statSync(join(DIST, u)).size;
    expect(total).toBeLessThanOrEqual(PRECACHE_BUDGET);
  });
});

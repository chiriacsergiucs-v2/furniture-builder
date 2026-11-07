// ADR-229: the Russian UI dictionary is a lazy chunk, so the `index` (entry) chunk every English user loads, and the
// rest of the app, carry little Cyrillic. Reads the production build (`pnpm build`); without `dist` it skips with a
// message (the CI `build` job builds first, then runs it).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIST = join(__dirname, '..', 'dist');
const ASSETS = join(DIST, 'assets');
const built = existsSync(join(DIST, 'index.html')) && existsSync(ASSETS);

/**
 * Cyrillic bytes (UTF-8) allowed in the entry chunk: the print dictionaries (`pt()`, kept eager by G-496) and the
 * language switch's own name "Русский". Before ADR-229 it held the whole Russian UI dictionary, 430 996 bytes.
 */
export const INDEX_CYRILLIC_BUDGET = 30_000;
/**
 * Cyrillic bytes allowed in all chunks but the Russian UI dictionary's: the entry's, plus the catalog's Russian
 * print names (`ru/data-catalog.ts`, read by the printed sheets whatever the UI language).
 */
export const OTHER_CYRILLIC_BUDGET = 100_000;
/** A Russian UI text (ru/viewer.ts) that only the lazy dictionary chunk holds. */
const RU_UI_TEXT = '3D-просмотр недоступен в этом браузере';

/** UTF-8 bytes of Cyrillic letters in a text (each takes two bytes). */
function cyrillicBytes(text: string): number {
  return (text.match(/[Ѐ-ӿ]/g)?.length ?? 0) * 2;
}

function chunks(): { name: string; text: string }[] {
  return readdirSync(ASSETS)
    .filter((f) => f.endsWith('.js'))
    .map((name) => ({ name, text: readFileSync(join(ASSETS, name), 'utf8') }));
}

/** The entry chunk named by dist/index.html (`assets/index-*.js`). */
function entryName(): string {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  const m = /<script type="module"[^>]*src="[^"]*assets\/(index-[^"]+\.js)"/.exec(html);
  if (!m) throw new Error('dist/index.html names no assets/index-*.js entry');
  return m[1];
}

describe('index chunk Cyrillic budget (ADR-229)', () => {
  it.skipIf(!built)(
    `the entry chunk has under ${INDEX_CYRILLIC_BUDGET} bytes of Cyrillic and no Russian UI dictionary`,
    () => {
      const entry = entryName();
      const text = readFileSync(join(ASSETS, entry), 'utf8');
      const bytes = cyrillicBytes(text);
      console.log(`${entry}: ${bytes} Cyrillic bytes (budget ${INDEX_CYRILLIC_BUDGET})`);
      expect(text.includes(RU_UI_TEXT), `${entry} holds the Russian UI dictionary`).toBe(false);
      expect(bytes).toBeLessThan(INDEX_CYRILLIC_BUDGET);
    },
  );

  it.skipIf(!built)(
    'the Russian UI dictionary is one lazy chunk; every other chunk together stays under budget',
    () => {
      const all = chunks();
      const dict = all.filter((c) => c.text.includes(RU_UI_TEXT));
      expect(dict.map((c) => c.name)).toHaveLength(1);
      expect(dict[0].name).not.toBe(entryName());
      const other = all.filter((c) => c !== dict[0]).reduce((n, c) => n + cyrillicBytes(c.text), 0);
      console.log(
        `${dict[0].name} holds the Russian UI dictionary; other chunks: ${other} Cyrillic bytes (budget ${OTHER_CYRILLIC_BUDGET})`,
      );
      expect(other).toBeLessThan(OTHER_CYRILLIC_BUDGET);
    },
  );

  it.runIf(!built)('skips without a build', () => {
    console.log('tests/bundle-cyrillic.test.ts: no dist/index.html; run `pnpm build` first.');
  });
});

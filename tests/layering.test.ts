import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// ADR-223: persistence sits behind the store. `src/ui` reaches saved data through `src/store/libraryStore.ts`, never
// through `src/persist/db` itself; the raw Dexie handle `db` is used only inside `src/persist`; and `src/persist`
// imports no React. Checked on the source text, so CI fails on a new offender; offenders are printed on failure.
const ROOT = new URL('..', import.meta.url).pathname;
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });

/** Every import in a source text: what it names (`*` for a namespace, `` for side effects) and where from. */
export function imports(text: string): { names: string[]; from: string }[] {
  const out: { names: string[]; from: string }[] = [];
  const names = (clause: string) => {
    const brace = /\{([^}]*)\}/.exec(clause);
    const list = brace
      ? brace[1]
          .split(',')
          .map((n) =>
            n
              .trim()
              .replace(/^type\s+/, '')
              .split(/\s+as\s+/)[0]
              .trim(),
          )
          .filter(Boolean)
      : [];
    if (/\*\s*as\s+\w+/.test(clause)) list.push('*');
    return list;
  };
  for (const m of text.matchAll(/\b(?:import|export)\s+([^;]*?)\bfrom\s*['"]([^'"]+)['"]/g))
    out.push({ names: names(m[1]), from: m[2] });
  for (const m of text.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm))
    out.push({ names: [], from: m[1] });
  // Dynamic imports: the names destructured from them when written `const { a, b } = await import('…')`.
  for (const m of text.matchAll(
    /(?:\{([^{}]*)\}\s*=\s*)?(?:await\s+)?\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ))
    out.push({ names: m[1] ? names(`{${m[1]}}`) : ['*'], from: m[2] });
  return out;
}

/** The repo-relative module an import resolves to, without extension. */
const target = (file: string, spec: string) =>
  spec.startsWith('.') ? posix.normalize(posix.join(posix.dirname(file), spec)) : spec;

/**
 * `src/ui` files allowed to import `src/persist/db`, each with its reason (ADR-223). Starts empty: saved data goes
 * through `src/store/libraryStore.ts`.
 */
const UI_PERSIST_DB_ALLOWED: Record<string, string> = {};

/** Why `file` may not import `names` from `spec`, or null (ADR-223). */
export function violation(file: string, spec: string, names: string[]): string | null {
  const to = target(file, spec);
  if (file.startsWith('src/ui/') && to === 'src/persist/db' && !(file in UI_PERSIST_DB_ALLOWED))
    return 'ui imports persist/db (use src/store/libraryStore)';
  if (
    !file.startsWith('src/persist/') &&
    to.startsWith('src/persist/') &&
    (names.includes('db') || (to === 'src/persist/db' && names.includes('*')))
  )
    return 'the raw db handle outside src/persist';
  if (file.startsWith('src/persist/') && /^react(-dom)?(\/|$)/.test(spec))
    return 'persist imports React';
  return null;
}

const SOURCES = files(join(ROOT, 'src')).map((f) => ({
  file: relative(ROOT, f).split(/[\\/]/).join('/'),
  text: readFileSync(f, 'utf8'),
}));

describe('persistence behind the store (ADR-223)', () => {
  it('no src/ui import of persist/db, no raw db outside src/persist, no React in src/persist', () => {
    const hits = SOURCES.flatMap(({ file, text }) =>
      imports(text).flatMap(({ names, from }) => {
        const why = violation(file, from, names);
        return why ? [`${file} → ${from} {${names.join(', ')}}: ${why}`] : [];
      }),
    );
    expect(hits).toEqual([]);
  });

  it('useImageUrls lives in src/ui', () => {
    const where = SOURCES.filter(({ text }) => /export function useImageUrls\b/.test(text)).map(
      (s) => s.file,
    );
    expect(where).toEqual(['src/ui/useImageUrls.ts']);
  });

  it('the allowlist names only files that exist and import persist/db', () => {
    for (const [file, why] of Object.entries(UI_PERSIST_DB_ALLOWED)) {
      const src = SOURCES.find((s) => s.file === file);
      expect(src, file).toBeTruthy();
      expect(why.length, file).toBeGreaterThan(0);
      expect(
        imports(src!.text).some(({ from }) => target(file, from) === 'src/persist/db'),
        file,
      ).toBe(true);
    }
  });

  it('the scan itself catches each forbidden import', () => {
    expect(
      imports(
        "import { a, type B, c as d } from '../persist/db';\nimport * as x from './y';\n" +
          "if (x) {\n  const { loadDesign } = await import('../persist/db');\n}\nconst m = await import('./z');",
      ),
    ).toEqual([
      { names: ['a', 'B', 'c'], from: '../persist/db' },
      { names: ['*'], from: './y' },
      { names: ['loadDesign'], from: '../persist/db' },
      { names: ['*'], from: './z' },
    ]);
    expect(violation('src/ui/a.tsx', '../persist/db', ['saveProject'])).not.toBeNull();
    expect(violation('src/ui/shell/a.tsx', '../../persist/db', ['listDesigns'])).not.toBeNull();
    expect(violation('src/ui/a.tsx', '../persist/images', ['importImage'])).toBeNull();
    expect(violation('src/ui/a.tsx', '../store/libraryStore', ['saveProject'])).toBeNull();
    expect(violation('src/store/a.ts', '../persist/db', ['db'])).not.toBeNull();
    expect(violation('src/online/a.ts', '../persist/db', ['*'])).not.toBeNull();
    expect(violation('src/store/a.ts', '../persist/db', ['saveProject'])).toBeNull();
    expect(violation('src/ui/a.tsx', '../persist/backup', ['*'])).toBeNull();
    expect(violation('src/persist/backup.ts', './db', ['db'])).toBeNull();
    expect(violation('src/persist/images.ts', 'react', ['useState'])).not.toBeNull();
    expect(violation('src/ui/a.tsx', 'react', ['useState'])).toBeNull();
  });
});

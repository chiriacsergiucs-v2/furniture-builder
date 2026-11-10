import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// No-regression cleanup guards (docs/research/2026-11-09-cleanup-audit.md, item 14): dead code removed on 2026-11-09
// cannot come back unnoticed. Each check has an allow-list for the cases that are intentional.
const ROOT = new URL('..', import.meta.url).pathname;
const walk = (dir: string, ext: RegExp): string[] =>
  readdirSync(join(ROOT, dir)).flatMap((n) => {
    const p = join(dir, n);
    return statSync(join(ROOT, p)).isDirectory() ? walk(p, ext) : ext.test(n) ? [p] : [];
  });
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const word = (name: string) => new RegExp(`(?<![\\w$])${escape(name)}(?![\\w$])`);

const SRC = walk('src', /\.(ts|tsx)$/);
/** Everything that may use an export: the app, the tests, the find-it scripts and the backend function. */
const USERS = [
  ...SRC,
  ...walk('tests', /\.(ts|tsx)$/),
  ...walk('tools', /\.(mjs|ts)$/),
  ...walk('supabase', /\.ts$/),
];
const text = new Map(USERS.map((f) => [f, read(f)]));

describe('dead code guards (cleanup audit 2026-11-09)', () => {
  it('every named export in src is used outside its own file', () => {
    const unused: string[] = [];
    for (const f of SRC) {
      const own = text.get(f)!;
      for (const m of own.matchAll(
        /^export (?:async )?(?:function|const|let|class|type|interface|enum) ([A-Za-z_$][\w$]*)/gm,
      )) {
        const re = word(m[1]);
        if (![...text].some(([g, t]) => g !== f && re.test(t))) unused.push(`${f}: ${m[1]}`);
      }
    }
    // Drop the `export` (used only in its file) or delete the code (used nowhere).
    expect(unused).toEqual([]);
  });

  it('every CSS class in src/styles.css is produced by some code', () => {
    const css = read('src/styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const code = SRC.map((f) => text.get(f)!).join('\n');
    // Built from a value at run time: `room-${kind}`, `impl-${status}`, `mode-${mode}`, and the research matrix's
    // `v${band}` and `c${complexity}` (Research.tsx).
    const DYNAMIC = ['room-', 'impl-', 'mode-'];
    const BUILT = /^(v\d+|c\d)$/;
    const classes = new Set([...css.matchAll(/\.([a-z][a-z0-9-]*)/g)].map((m) => m[1]));
    const dead = [...classes].filter(
      (c) =>
        !DYNAMIC.some((p) => c.startsWith(p)) &&
        !BUILT.test(c) &&
        !new RegExp(`(?<![\\w-])${escape(c)}(?![\\w-])`).test(code),
    );
    expect(dead).toEqual([]);
  });

  it('every Russian entry for code text still has its English text in src', () => {
    const code = SRC.filter((f) => !f.includes('/i18n/ru/'))
      .map((f) => text.get(f)!)
      .join('\n');
    const dir = 'src/core/i18n/ru';
    const orphans: string[] = [];
    for (const n of readdirSync(join(ROOT, dir))) {
      if (n.startsWith('data-') || n === 'index.ts') continue;
      const src = read(`${dir}/${n}`);
      for (const m of src.matchAll(
        /^\s+(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|([A-Za-z]\w*)):/gm,
      )) {
        const key = (m[1] ?? m[2] ?? m[3]).replace(/\\'/g, "'");
        if (!code.includes(key)) orphans.push(`${relative(dir, join(dir, n))}: ${key}`);
      }
    }
    // A deleted text deletes its entries (CLAUDE.md translation rule).
    expect(orphans).toEqual([]);
  });
});

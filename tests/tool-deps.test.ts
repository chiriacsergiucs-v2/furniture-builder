// ADR-237: every browser acceptance script (`tools/*/find-it*.mjs`) and the shared harness it uses imports only
// packages declared in package.json, so the scripts run from a clean clone (`pnpm install --frozen-lockfile`).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
]);

/** The scripts: every `tools/<area>/find-it*.mjs`, and `tools/lib/*.mjs` when it exists. */
function scripts(): string[] {
  const tools = join(root, 'tools');
  const out: string[] = [];
  for (const area of readdirSync(tools, { withFileTypes: true })) {
    if (!area.isDirectory()) continue;
    for (const f of readdirSync(join(tools, area.name)))
      if (/^find-it.*\.mjs$/.test(f) || (area.name === 'lib' && f.endsWith('.mjs')))
        out.push(join(tools, area.name, f));
  }
  return out.sort();
}

/** The bare package names a module imports (static and dynamic), without node built-ins and relative paths. */
function bareImports(src: string): string[] {
  const specs = [
    ...src.matchAll(/^\s*import\s[^'"]*?from\s*['"]([^'"]+)['"]/gm),
    ...src.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm),
    ...src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g),
  ].map((m) => m[1]);
  return specs
    .filter((s) => !s.startsWith('.') && !s.startsWith('/') && !s.startsWith('node:'))
    .filter((s) => !builtinModules.includes(s))
    .map((s) => (s.startsWith('@') ? s.split('/').slice(0, 2).join('/') : s.split('/')[0]));
}

describe('browser acceptance scripts (ADR-237)', () => {
  it('finds the find-it scripts', () => {
    expect(scripts().length).toBeGreaterThan(50);
  });
  it('every package a find-it script or the harness imports is declared in package.json', () => {
    const missing: string[] = [];
    for (const f of scripts())
      for (const name of bareImports(readFileSync(f, 'utf8')))
        if (!declared.has(name)) missing.push(`${f.slice(root.length + 1)}: ${name}`);
    expect(missing).toEqual([]);
  });
  it('the scripts share tools/lib/harness.mjs', () => {
    expect(existsSync(join(root, 'tools/lib/harness.mjs'))).toBe(true);
    const without = scripts()
      .filter((f) => !f.includes(`${join('tools', 'lib')}`))
      .filter((f) => !readFileSync(f, 'utf8').includes("from '../lib/harness.mjs'"));
    expect(without.map((f) => f.slice(root.length + 1))).toEqual([]);
  });
});

// ADR-212 (G-377): the Rapier trial devDependency is gone. `package.json` no longer names `@dimforge/rapier3d-compat`,
// the lockfile's importers (what `pnpm install --frozen-lockfile` checks against package.json) no longer list it, and
// no source, test or tool imports it. `@types/three`'s own 0.12.0 copy stays (ADR-212 item 6).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PKG = '@dimforge/rapier3d-compat';
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('Rapier devDependency removed (ADR-212, G-377)', () => {
  it('package.json does not name it in any dependency list', () => {
    const pkg = JSON.parse(read('package.json')) as Record<string, unknown>;
    for (const key of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies',
    ]) {
      const deps = (pkg[key] ?? {}) as Record<string, string>;
      expect(Object.keys(deps), key).not.toContain(PKG);
    }
    expect(read('package.json')).not.toContain('rapier');
  });

  it("the lockfile's importers do not list it; only @types/three still depends on its own copy", () => {
    const lock = read('pnpm-lock.yaml');
    // pnpm writes two YAML documents (the package manager's, then the project's); each has an importers section.
    const importers = [...lock.matchAll(/^importers:\n([\s\S]*?)\n(?=\S)/gm)]
      .map((m) => m[1])
      .join('\n');
    expect(importers).toContain('devDependencies');
    expect(importers).not.toContain('rapier');
    // Every remaining mention is the package entry itself or a dependency line of @types/three.
    const owners = new Set<string>();
    let current = '';
    for (const line of lock.split('\n')) {
      const head = /^ {2}'?([^ '][^']*?)'?:\s*(\{\})?$/.exec(line);
      if (head) current = head[1];
      if (line.includes(PKG) && !head) owners.add(current);
    }
    expect([...owners].every((o) => o.startsWith('@types/three@'))).toBe(true);
  });

  it('no tracked source, test or tool imports it', () => {
    const r = spawnSync(
      'git',
      ['grep', '-l', '-e', `from '${PKG}`, '-e', `import('${PKG}`, '--', 'src', 'tests', 'tools'],
      { encoding: 'utf8', cwd: new URL('..', import.meta.url) },
    );
    // git grep exits 1 when nothing matches.
    expect(r.stdout).toBe('');
    expect(r.status).toBe(1);
  });
});

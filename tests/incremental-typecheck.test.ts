import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// ADR-220: `tsc -b` keeps its state between runs (incremental, buildinfo under node_modules/.tmp), and the `checks`
// job of CI restores that folder and saves it on pushes to main, like the lint cache.
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const job = (yml: string, name: string) => {
  const start = yml.indexOf(`\n  ${name}:\n`);
  const rest = yml.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[\w-]+:\n/);
  return next < 0 ? rest : rest.slice(0, next + 1);
};
/** The steps of a job, each as its text. */
const steps = (block: string) => block.split(/\n {6}- /).slice(1);

describe('incremental type-checking (ADR-220)', () => {
  for (const file of ['tsconfig.app.json', 'tsconfig.node.json']) {
    it(`${file} is incremental with its buildinfo under node_modules/.tmp`, () => {
      const { compilerOptions } = JSON.parse(read(file));
      expect(compilerOptions.incremental).toBe(true);
      expect(compilerOptions.tsBuildInfoFile).toMatch(/^\.\/node_modules\/\.tmp\//);
    });
  }

  it('the checks job restores node_modules/.tmp before typecheck and saves it on pushes only', () => {
    const checks = job(read('.github/workflows/ci.yml'), 'checks');
    const all = steps(checks);
    const restore = all.findIndex(
      (s) => s.includes('actions/cache/restore@') && s.includes('node_modules/.tmp'),
    );
    const typecheck = all.findIndex((s) => s.includes('run: pnpm typecheck'));
    const save = all.findIndex(
      (s) => s.includes('actions/cache/save@') && s.includes('node_modules/.tmp'),
    );
    expect(restore).toBeGreaterThanOrEqual(0);
    expect(typecheck).toBeGreaterThan(restore);
    expect(save).toBeGreaterThan(typecheck);
    expect(all[save]).toContain("if: github.event_name == 'push'");
    for (const s of [all[restore], all[save]]) {
      expect(s).toMatch(
        /key: tsc-.*pnpm-lock\.yaml.*tsconfig\.app\.json.*tsconfig\.node\.json.*github\.sha/,
      );
    }
    expect(all[restore]).toMatch(/restore-keys: \|\n\s+tsc-/);
  });
});

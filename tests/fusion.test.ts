import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { templates } from '../src/core/design';
import { exportFusionPython, fusionGroups } from '../src/core/fusion';
import { catalogFamilies, insertVariant } from '../src/core/catalog';

const python = (() => {
  try {
    execFileSync('python3', ['--version']);
    return 'python3';
  } catch {
    return null;
  }
})();

describe('Fusion 360 export (ADR-021)', () => {
  it('groups every panel exactly once: carcass, doors, one group per drawer', () => {
    const d = templates.find((t) => t.id === 'sideboard')!.create();
    const m = buildModel(d);
    const g = fusionGroups(m);
    expect(g.map((x) => x.name)).toEqual(['Carcass', 'Doors', 'Drawer 1', 'Drawer 2', 'Drawer 3']);
    expect(g.reduce((n, x) => n + x.panels.length, 0)).toBe(m.panels.length);
    for (const dr of g.filter((x) => x.name.startsWith('Drawer')))
      expect(dr.panels.some((p) => p.role === 'drawer-front')).toBe(true);
  });
  it('emits one body per panel in centimetres with height on Fusion Z, for every template', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fusion-'));
    for (const t of templates) {
      const d = t.create();
      const m = buildModel(d);
      const src = exportFusionPython(d, m);
      expect(src).toContain('NOT verified inside Fusion');
      const rows = src.split('\n').filter((l) => /^ {4}\("/.test(l));
      expect(rows.length).toBe(m.panels.length);
      const top = Math.max(...m.panels.map((p) => p.box.y + p.box.h));
      // Each row ends: centre z, then sizes (x, y, z), then two direction vectors.
      const maxZ = Math.max(
        ...rows.map((r) => {
          const n = r.match(/-?\d+(\.\d+)?/g)!.map(Number);
          return n[n.length - 10] + n[n.length - 7] / 2;
        }),
      );
      expect(maxZ).toBeCloseTo(top / 10, 3);
      if (python) {
        const f = join(dir, `${t.id}.py`);
        writeFileSync(f, src);
        execFileSync(python, ['-m', 'py_compile', f]);
      }
    }
  });
  it('shaped parts (ADR-040): tilted parts carry turned directions, profiles become sketches; the script compiles', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fusion-shaped-'));
    for (const id of [
      'corner-diagonal',
      'sink-u-drawer',
      'recliner-reference',
      'lounger-reference',
    ]) {
      const f = catalogFamilies.find((x) => x.variants.some((v) => v.id === id))!;
      const d = insertVariant(
        f,
        f.variants.find((v) => v.id === id)!,
        '',
      )!;
      const m = buildModel(d);
      const src = exportFusionPython(d, m);
      const rows = src.split('\n').filter((l) => /^ {4}\("/.test(l));
      expect(rows.length, id).toBe(m.panels.length);
      const profiled = m.panels.filter((p) => p.shape?.kind === 'profile').length;
      expect(rows.filter((r) => /"(xy|xz|yz)"/.test(r)).length, id).toBe(profiled);
      // A turned direction has a component that is neither 0 nor ±1.
      const dirs = rows
        .filter((r) => !/"(xy|xz|yz)"/.test(r))
        .map((r) =>
          r
            .match(/-?\d+(\.\d+)?/g)!
            .map(Number)
            .slice(-6),
        );
      const turned = dirs.filter((v) =>
        v.some((c) => Math.abs(c) > 1e-6 && Math.abs(Math.abs(c) - 1) > 1e-6),
      ).length;
      expect(turned, id).toBe(m.panels.filter((p) => p.shape?.kind === 'tilt').length);
      if (python) {
        const file = join(dir, `${id}.py`);
        writeFileSync(file, src);
        execFileSync(python, ['-m', 'py_compile', file]);
      }
    }
  });
});

// G-005: the checklist for the first run of the Fusion 360 export (docs/fusion-check.md) states, for two sample
// designs, the bodies and groups the script must make and the overall size. Those numbers come from the model; this
// test keeps the checklist equal to it.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { templates } from '../src/core/design';
import { exportFusionPython, fusionGroups } from '../src/core/fusion';

function expected(id: string) {
  const d = templates.find((t) => t.id === id)!.create();
  const m = buildModel(d);
  const groups = fusionGroups(m).map((g) => `${g.name}: ${g.panels.length}`);
  const bodies = fusionGroups(m).reduce((a, g) => a + g.panels.length, 0);
  const xs = m.panels.flatMap((p) => [p.box.x, p.box.x + p.box.w]);
  const ys = m.panels.flatMap((p) => [p.box.y, p.box.y + p.box.h]);
  const zs = m.panels.flatMap((p) => [p.box.z, p.box.z + p.box.d]);
  const size = [xs, ys, zs].map((v) => Math.max(...v) - Math.min(...v));
  return { name: d.name, bodies, groups, size, script: exportFusionPython(d, m) };
}

describe('Fusion first-run checklist (G-005)', () => {
  const doc = readFileSync('docs/fusion-check.md', 'utf8');
  for (const id of ['base-door', 'chest']) {
    it(`states the bodies, groups and size of the ${id} template`, () => {
      const e = expected(id);
      expect(e.script.length).toBeGreaterThan(0);
      const row = doc
        .split('\n')
        .map((l) => l.split('|').map((c) => c.trim()))
        .find((c) => c[1] === e.name);
      expect(row?.slice(2, 5)).toEqual([
        String(e.bodies),
        e.groups.join(', '),
        `${e.size[0]} × ${e.size[1]} × ${e.size[2]} mm (Fusion: ${e.size[0] / 10} × ${e.size[2] / 10} × ${e.size[1] / 10} cm in X × Y × Z)`,
      ]);
    });
  }
});

/**
 * ADR-304 (G-492): checks that told fronts and drawer parts apart by their English label read panel fields instead.
 * The golden was written on the unchanged source (labels and regexes) and must stay identical: opening clearances
 * with the door swing, the assembly's drawer boxes, the Fusion groups, the wide-door guidance and the project's
 * clearance zone kinds, for every catalog variant (also squeezed and stretched), every template and every sample.
 * `WRITE_GOLDEN=1 pnpm exec vitest run tests/panel-front-kind.test.ts` rewrites the file.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assemblySteps } from '../src/core/assembly';
import { buildModel } from '../src/core/build';
import { catalogFamilies, insertVariant } from '../src/core/catalog';
import { localClearances } from '../src/core/clearance';
import { templates } from '../src/core/design';
import { fusionGroups } from '../src/core/fusion';
import { buildProjectModel, makeItem, newProject } from '../src/core/project';
import type { Design, FurnitureModel, Panel } from '../src/core/types';
import { sampleProjects } from './fixtures/mobila';

const NOW = '2026-11-07T00:00:00.000Z';

const sized = (d: Design, f: number): Design => {
  const c = structuredClone(d);
  const p = c.product.params as unknown as Record<string, unknown>;
  for (const k of ['width', 'height', 'depth'])
    if (typeof p[k] === 'number') p[k] = Math.round((p[k] as number) * f);
  return c;
};

function designs(): { id: string; d: Design }[] {
  const out: { id: string; d: Design }[] = [];
  for (const f of catalogFamilies)
    for (const v of f.variants) {
      const d = insertVariant(f, v, NOW);
      if (d) out.push({ id: `catalog:${f.id}/${v.id}`, d });
    }
  for (const t of templates) out.push({ id: `template:${t.id}`, d: t.create() });
  return out.flatMap(({ id, d }) => [
    { id, d },
    { id: `${id}@x0.25`, d: sized(d, 0.25) },
    { id: `${id}@x3`, d: sized(d, 3) },
    ...(JSON.stringify(d).includes('"drawers"') ? [{ id: `${id}@fixedTop`, d: fixedTop(d) }] : []),
  ]);
}

/** Every drawer space with a fixed top front (ADR-054), so the fixed-front checks run too. */
function fixedTop(d: Design): Design {
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      if (o.kind === 'drawers' && typeof o.count === 'number') o.fixedTop = true;
      Object.values(o).forEach(walk);
    }
  };
  const c = structuredClone(d);
  walk(c);
  return c;
}

/** Everything the switched checks decide for one model. */
function decided(m: FurnitureModel) {
  return {
    clearances: localClearances(m),
    boxes: assemblySteps(m)
      .flatMap((s) => s.boxes)
      .map((b) => [b.times, b.parts.map((x) => [x.label, x.quantity, x.size, x.panelIds])]),
    fusion: fusionGroups(m).map((g) => [g.name, g.panels.map((p) => p.id)]),
    wide: m.diagnostics.filter((x) => x.code === 'door-wide').map((x) => x.panelIds),
  };
}

/** The random ids of `input` in `out` replaced by `#1`, `#2`… in order of first use, so the golden is stable. */
function stable(input: unknown, out: unknown): unknown {
  const ids = [...JSON.stringify(input).matchAll(/"id":"([^"]+)"/g)].map((x) => x[1]);
  let text = JSON.stringify(out);
  const order = ids
    .filter((id, i) => ids.indexOf(id) === i && text.includes(id))
    .sort((a, b) => text.indexOf(a) - text.indexOf(b) || b.length - a.length);
  order.forEach((id, i) => (text = text.split(id).join(`#${i + 1}`)));
  return JSON.parse(text);
}

function listing() {
  const rows: unknown[] = [];
  for (const { id, d } of designs()) rows.push([id, stable(d, decided(buildModel(d)))]);
  // Every catalog variant side by side in one project, so the flap zones are listed too.
  let row = newProject('Every variant');
  for (const { id, d } of designs())
    if (id.startsWith('catalog:') && !id.includes('@'))
      row = { ...row, items: [...row.items, makeItem(row, d)] };
  for (const s of [...sampleProjects, { id: 'every-variant', create: () => row }]) {
    const p = s.create();
    const pm = buildProjectModel(p);
    rows.push([
      `sample:${s.id}`,
      stable(p, [
        pm.zones.map((z) => [z.itemId, z.kind, z.label, z.severity]),
        pm.pieces.map((pc) => pc.clearances),
      ]),
    ]);
  }
  return rows;
}

describe('panel front and drawer fields (ADR-304)', () => {
  it('clearances, drawer boxes, Fusion groups, wide doors and zone kinds match the golden written on the labels', () => {
    const file = new URL('./fixtures/panel-front-kind-golden.json', import.meta.url);
    const now = listing();
    if (process.env.WRITE_GOLDEN)
      writeFileSync(file, `${JSON.stringify(now).replace(/\],\["/g, '],\n["')}\n`);
    expect(existsSync(file)).toBe(true);
    expect(now).toEqual(JSON.parse(readFileSync(file, 'utf8')));
    expect(now.length).toBeGreaterThan(300);
  });

  it('the fields of every panel say what its English label said (the regexes the checks used before)', () => {
    const panels: Panel[] = [
      ...designs().flatMap(({ d }) => buildModel(d).panels),
      ...sampleProjects.flatMap((s) => buildProjectModel(s.create()).model.panels),
    ];
    const seen = new Set<string>();
    for (const p of panels) {
      const at = `${p.id} "${p.label}"`;
      if (p.role === 'door') {
        expect(p.front === 'sliding', at).toBe(/^Sliding door/.test(p.label));
        expect(p.front === 'flap-up' || p.front === 'flap-down', at).toBe(/flap/i.test(p.label));
        expect(p.front === 'flap-up', at).toBe(/^Lift-up/.test(p.label));
        expect(p.front === 'hinged', at).toBe(/^Door/.test(p.label));
        if (!p.shape) {
          const was =
            p.label === 'Door left'
              ? 'left'
              : p.label === 'Door right'
                ? 'right'
                : p.label === 'Door'
                  ? 'plates'
                  : null;
          expect(p.hinge ?? (p.front === 'hinged' ? 'plates' : null), at).toBe(was);
        }
      } else expect(p.hinge, at).toBeUndefined();
      if (p.role === 'drawer-front')
        expect(p.front === 'fixed', at).toBe(/^Fixed front/.test(p.label));
      else if (p.role !== 'door') expect(p.front, at).toBeUndefined();
      if (p.role.startsWith('drawer')) {
        expect(p.drawer?.toString(), at).toBe(/^Drawer (\d+)\b/.exec(p.label)?.[1]);
        expect(p.drawer?.toString(), at).toBe(/^Drawer (\d+)/.exec(p.label)?.[1]);
      } else expect(p.drawer, at).toBeUndefined();
      seen.add(p.front ?? (p.drawer ? 'drawer' : ''));
    }
    // Every kind of front the checks tell apart is in the set.
    for (const k of ['hinged', 'sliding', 'flap-up', 'flap-down', 'fixed', 'drawer'])
      expect(seen).toContain(k);
  });
});

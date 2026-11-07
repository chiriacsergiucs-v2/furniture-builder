// ADR-221: the project cut list and hardware stay byte-identical when they read the project model and `placeItem`
// is memoised. The golden file was written on `main` before the change (WRITE_GOLDEN=1 regenerates it).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import {
  buildProjectModel,
  makeItem,
  newProject,
  projectCutlist,
  projectHardware,
  suggestRunParts,
  type Project,
} from '../src/core/project';
import type { CabinetParams, Design } from '../src/core/types';
import { sampleProjects } from './fixtures/mobila';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const cab = (d: Design, patch: Partial<CabinetParams>): Design =>
  d.product.kind === 'cabinet'
    ? { ...d, product: { ...d.product, params: { ...d.product.params, ...patch } } }
    : d;

/**
 * A run that takes every per-piece build option: a run plinth (pieces lose their own), a common top, shared sides
 * with pin rows, a run handle and a piece placed above another.
 */
function features(): Project {
  let p = newProject('Features');
  const designs = [
    t('base-door'),
    t('base-door'),
    cab(t('base-door'), { interior: { id: 'dr', kind: 'drawers', count: 3 } }),
    t('base-door'),
  ];
  for (const d of designs) p = { ...p, items: [...p.items, makeItem(p, d)] };
  const [a, b, c, d] = p.items.map((i) => i.id);
  const wall = makeItem(p, cab(t('base-door'), { mount: 'wall', mountHeight: 1500 }));
  p = {
    ...p,
    items: [...p.items, { ...wall, placement: { kind: 'above', baseId: a, gap: 800, offsetX: 0 } }],
  };
  return {
    ...p,
    runParts: suggestRunParts(p),
    common: [{ id: 'c1', kind: 'top', itemIds: [a, b] }],
    sharedSides: [{ id: 's1', itemIds: [c, d] }],
    runHandles: [
      { id: 'rh1', from: [a, b, c, d], handle: { kind: 'bar', holeSpacing: 128 }, height: 600 },
    ],
  };
}

const projects: { name: string; create: () => Project }[] = [
  ...sampleProjects.map((s) => ({ name: s.id, create: s.create })),
  { name: 'features', create: features },
];

/** Random ids (items, run parts, template nodes) replaced by their place, so the output is the same on every run. */
function normalised(p: Project, value: unknown): unknown {
  let s = JSON.stringify(value);
  const ids = [
    ...p.items.map((i, n) => [i.id, `item${n}`]),
    ...(p.runParts ?? []).map((r, n) => [r.id, `run${n}`]),
  ];
  for (const [id, to] of ids) s = s.split(id).join(to);
  // Template node ids are random too: each one by its first appearance.
  const nodes = new Map<string, string>();
  s = s.replace(/(?<=["/:])[0-9a-f]{8}(?=["/])/g, (id) => {
    if (!nodes.has(id)) nodes.set(id, `node${nodes.size}`);
    return nodes.get(id)!;
  });
  return JSON.parse(s);
}

const golden = new URL('./fixtures/project-rows.golden.json', import.meta.url);

describe('project cut list and hardware golden (ADR-221)', () => {
  it('rows and hardware of every sample project are byte-identical to the golden file', () => {
    const out: Record<string, unknown> = {};
    for (const { name, create } of projects) {
      const p = create();
      const pm = buildProjectModel(p);
      const rows = projectCutlist(p);
      const hardware = projectHardware(p);
      // The callers that hold the project model pass it; the result is the same.
      expect(projectCutlist(p, pm)).toEqual(rows);
      expect(projectHardware(p, pm)).toEqual(hardware);
      out[name] = normalised(p, { rows, hardware });
    }
    if (process.env.WRITE_GOLDEN) writeFileSync(golden, `${JSON.stringify(out, null, 2)}\n`);
    expect(existsSync(golden), 'golden missing: run WRITE_GOLDEN=1 on main').toBe(true);
    // Compared as serialised text, so the file's own formatting (Prettier) does not matter.
    expect(JSON.stringify(out)).toBe(JSON.stringify(JSON.parse(readFileSync(golden, 'utf8'))));
  });

  it('the features project really takes every build option', () => {
    const p = features();
    const rows = projectCutlist(p);
    expect(rows.some((r) => r.labels.includes('Common top'))).toBe(true);
    expect(rows.some((r) => r.labels.some((l) => l.startsWith('Run: ')))).toBe(true);
    expect(rows.some((r) => /handle holes/.test(r.drilling))).toBe(true);
    const sides = buildProjectModel(p).model.panels.filter((x) => x.role === 'side');
    expect(sides).toHaveLength(9);
  });
});

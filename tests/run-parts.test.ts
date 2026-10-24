import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { templates } from '../src/core/design';
import {
  buildProjectModel,
  makeItem,
  newProject,
  planRuns,
  projectCutlist,
  refreshRunParts,
  suggestRunParts,
  validateProject,
  type Project,
} from '../src/core/project';
import type { CabinetParams, Design, Space } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const cab = (d: Design, patch: Partial<CabinetParams>): Design =>
  d.product.kind === 'cabinet'
    ? { ...d, product: { ...d.product, params: { ...d.product.params, ...patch } } }
    : d;
function run(patches: Partial<CabinetParams>[] = [{}, {}, {}]): Project {
  let p = newProject('Run');
  for (const patch of patches)
    p = {
      ...p,
      items: [...p.items, makeItem(p, cab(t('base-door'), { bottom: 'under', ...patch }))],
    };
  return {
    ...p,
    items: p.items.map((it) => ({ ...it, position: { ...it.position, x: it.position.x + 100 } })),
  };
}
const plinthRows = (p: Project) =>
  projectCutlist(p).filter((r) => r.labels.some((l) => /Plinth/.test(l)));

describe('run plinth, scribe and fixed front (ADR-054)', () => {
  it('a run of three base units gets one plinth of the run length; the pieces lose their own plinths', () => {
    const p0 = run();
    const parts = suggestRunParts(p0);
    const pl = parts.filter((r) => r.kind === 'plinth');
    expect(pl).toHaveLength(1);
    expect(pl[0].box.w).toBe(1800);
    expect(pl[0].from).toEqual(p0.items.map((i) => i.id));
    const p = { ...p0, runParts: parts };
    const pm = buildProjectModel(p);
    expect(pm.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(pm.model.panels.filter((x) => x.role === 'plinth')).toHaveLength(1);
    const rows = plinthRows(p);
    expect(rows.reduce((n, r) => n + r.quantity, 0)).toBe(1);
    expect(rows[0].length).toBe(1800);
    expect(plinthRows(p0).reduce((n, r) => n + r.quantity, 0)).toBe(3);
  });
  it('different plinth heights or sides on the floor: no run plinth, a note with the reason', () => {
    const mixed = planRuns(run([{}, { plinthHeight: 120 }, {}]));
    expect(mixed.parts.some((r) => r.kind === 'plinth')).toBe(false);
    expect(mixed.notes.join(' ')).toMatch(/plinth heights differ/);
    const floor = planRuns(run([{}, { bottom: 'between' }, {}]));
    expect(floor.parts.some((r) => r.kind === 'plinth')).toBe(false);
    expect(floor.notes.join(' ')).toMatch(/reach the floor/);
  });
  it('scribe allowance widens the filler in the cut list only', () => {
    const p0 = run();
    const gapped = {
      ...p0,
      items: p0.items.map((it, i) =>
        i === 2 ? { ...it, position: { ...it.position, x: it.position.x + 37 } } : it,
      ),
      runSettings: { scribe: 20, auto: false },
    };
    const filler = suggestRunParts(gapped).find((r) => r.kind === 'filler')!;
    expect(filler.box.w).toBe(37);
    expect(filler.scribe).toBe(20);
    expect(filler.reason).toContain('37 mm + 20 mm scribe');
    const p = { ...gapped, runParts: suggestRunParts(gapped) };
    const row = projectCutlist(p).find((r) => r.labels.some((l) => l === 'Run: Filler'))!;
    expect([row.length, row.width]).toContain(57);
    expect(buildProjectModel(p).diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(validateProject(p)).toEqual([]);
  });
  it('a fixed top front keeps the front and drops the box and one runner pair; fixing is user-specified', () => {
    const d = t('chest');
    const fix = (s: Space): Space =>
      s.kind === 'drawers'
        ? { ...s, fixedTop: true }
        : s.kind === 'split'
          ? { ...s, children: s.children.map(fix) }
          : s;
    const fixed =
      d.product.kind === 'cabinet'
        ? {
            ...d,
            product: {
              ...d.product,
              params: { ...d.product.params, interior: fix(d.product.params.interior) },
            },
          }
        : d;
    const a = buildModel(d),
      b = buildModel(fixed);
    const count = (m: typeof a, role: string) => m.panels.filter((p) => p.role === role).length;
    expect(count(b, 'drawer-front')).toBe(count(a, 'drawer-front'));
    expect(count(b, 'drawer-side')).toBe(count(a, 'drawer-side') - 2);
    const runners = (m: typeof a) =>
      m.hardware.filter((h) => h.kind === 'drawer-runner-pair').reduce((n, h) => n + h.quantity, 0);
    expect(runners(b)).toBe(runners(a) - 1);
    expect(
      b.hardware.some((h) => h.kind === 'front-fixing' && /user-specified/.test(h.note ?? '')),
    ).toBe(true);
    expect(b.diagnostics.filter((x) => x.severity === 'error')).toEqual([]);
  });
});

describe('run parts stay up to date (ADR-061)', () => {
  const st = () => useDesign.getState();
  beforeEach(() => {
    const p = run();
    st().openProject({ ...p, items: [] });
    for (const it of p.items) st().addPiece(it.design);
    st().suggestRunParts();
  });
  it('moving a piece updates the worktop and the filler in the same step; undo restores both', () => {
    const before = st().project!;
    const wt0 = before.runParts!.find((r) => r.kind === 'worktop')!;
    const last = before.items[2];
    st().setGap(last.id, 100, true);
    const after = st().project!;
    const filler = after.runParts!.find((r) => r.kind === 'filler')!;
    expect(filler.box.w).toBe(100);
    const wt = after.runParts!.find((r) => r.kind === 'worktop')!;
    expect(wt.box.w).toBe(wt0.box.w + 100);
    expect(wt.changed).toBe(`${wt0.box.w} → ${wt.box.w} mm`);
    expect(
      buildProjectModel(after).diagnostics.filter((d) => d.code === 'run-part-overlap'),
    ).toEqual([]);
    st().undoProject();
    expect(st().project).toBe(before);
  });
  it('a removed part stays removed after a move until "Suggest again"; a removed piece drops the override', () => {
    const cover = st().project!.runParts!.find((r) => r.kind === 'cover')!;
    st().removeRunPart(cover.id);
    const p = st().project!;
    st().updateItem(p.items[1].id, { quantity: 2 });
    expect(st().project!.runParts!.some((r) => r.key === cover.key)).toBe(false);
    st().suggestRunParts();
    expect(st().project!.runParts!.some((r) => r.key === cover.key)).toBe(true);
    st().removeRunPart(cover.id);
    st().removeItem(cover.from![0]);
    expect(st().project!.runPartsRemoved).toEqual([]);
  });
  it('refresh is a no-op when nothing changed; off keeps the stored parts', () => {
    const p = st().project!;
    expect(refreshRunParts(p)).toBe(p);
    const off = {
      ...p,
      runSettings: { scribe: 0, auto: false },
      items: p.items.map((it, i) =>
        i === 2 ? { ...it, position: { ...it.position, x: it.position.x + 50 } } : it,
      ),
    };
    expect(refreshRunParts(off)).toBe(off);
  });
});

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
import { panelsOverlap } from '../src/core/shape';
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
const named = (p: Project, names: string[]): Project => ({
  ...p,
  items: p.items.map((it, i) => ({ ...it, design: { ...it.design, name: names[i] } })),
});
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
  it('a run plinth needs the same body board, not only the same thickness; the note names the boards', () => {
    const p0 = named(run(), ['A', 'B', 'C']);
    const grey = {
      ...p0,
      items: p0.items.map((it, i) => {
        if (i !== 1 || it.design.product.kind !== 'cabinet') return it;
        const body = it.design.product.params.bodyMaterialId;
        return {
          ...it,
          design: {
            ...it.design,
            materials: it.design.materials.map((m) =>
              m.id === body ? { ...m, name: 'PAL 18 grey' } : m,
            ),
          },
        };
      }),
    };
    const r = planRuns(grey);
    expect(r.parts.some((x) => x.kind === 'plinth')).toBe(false);
    expect(r.notes.join(' ')).toMatch(
      /body boards differ \(A .+ 18 mm, B PAL 18 grey 18 mm, C .+\)/,
    );
  });
  it('different setbacks: the note names each piece with its setback, like the height note', () => {
    const r = planRuns(named(run([{}, { plinthSetback: 70 }, {}]), ['A', 'B', 'C']));
    expect(r.parts.some((x) => x.kind === 'plinth')).toBe(false);
    expect(r.notes.join(' ')).toContain('plinth setbacks differ (A 50 mm, B 70 mm, C 50 mm)');
    const deep = planRuns(named(run([{}, { depth: 580 }, {}]), ['A', 'B', 'C']));
    expect(deep.notes.join(' ')).toMatch(
      /plinth fronts are not in line \(A \d+ mm from the back, B \d+ mm from the back, C \d+ mm from the back\)/,
    );
  });
  it('stale run parts (refresh off): a part for a removed piece or a plinth of the wrong length is an error', () => {
    const p0 = run();
    const p: Project = {
      ...p0,
      runParts: suggestRunParts(p0),
      runSettings: { scribe: 0, auto: false },
    };
    const stale = (q: Project) =>
      buildProjectModel(q).diagnostics.filter((d) => d.code === 'run-part-stale');
    expect(stale(p)).toEqual([]);
    const gone = { ...p, items: p.items.slice(0, 2) };
    const s1 = stale(gone);
    expect(s1.length).toBeGreaterThan(0);
    expect(s1[0].severity).toBe('error');
    expect(s1.map((d) => d.message)).toContain(
      'Plinth was made for pieces that changed or were removed; suggest the run parts again.',
    );
    const moved = {
      ...p,
      items: p.items.map((it, i) =>
        i === 2 ? { ...it, position: { ...it.position, x: it.position.x + 50 } } : it,
      ),
    };
    expect(stale(moved).map((d) => d.message)).toEqual([
      'Plinth was made for pieces that changed or were removed; suggest the run parts again.',
    ]);
    const again = { ...moved, runParts: suggestRunParts(moved) };
    expect(stale(again)).toEqual([]);
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
  it('a removed FILLER stays removed after a real move', () => {
    const last = st().project!.items[2];
    st().setGap(last.id, 80, true);
    const filler = st().project!.runParts!.find((r) => r.kind === 'filler')!;
    expect(filler.box.w).toBe(80);
    st().removeRunPart(filler.id);
    st().setGap(last.id, 120, true);
    const p = st().project!;
    expect(p.items[2].position.x - (p.items[1].position.x + 600)).toBe(120);
    expect(p.runParts!.some((r) => r.kind === 'filler')).toBe(false);
    const wt = p.runParts!.find((r) => r.kind === 'worktop')!.box.w;
    st().updateItem(last.id, {
      position: { ...p.items[2].position, x: p.items[2].position.x + 10 },
    });
    expect(st().project!.runParts!.some((r) => r.kind === 'filler')).toBe(false);
    // The refresh did run (the worktop followed the move); only the removed filler stays out.
    expect(st().project!.runParts!.find((r) => r.kind === 'worktop')!.box.w).toBe(wt + 10);
  });
  it('"Suggest run parts" keeps automatic refresh off when the user turned it off', () => {
    expect(st().project!.runSettings!.auto).toBe(true);
    st().setRunSettings({ auto: false, scribe: 15 });
    st().suggestRunParts();
    expect(st().project!.runSettings).toEqual({ scribe: 15, auto: false });
    st().setRunSettings({ auto: true });
    st().suggestRunParts();
    expect(st().project!.runSettings).toEqual({ scribe: 15, auto: true });
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

describe('run parts, seeded project fuzz (ADR-036/054/061)', () => {
  let seed = Number(process.env.SEED ?? 4242);
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const pick = <T>(xs: readonly T[]): T => xs[ri(0, xs.length - 1)];
  it('without errors, no run part overlaps a piece and every run plinth is as long as its run', () => {
    const N = Math.max(50, Math.ceil(Number(process.env.FUZZ_N ?? 3000) / 10));
    let plinths = 0;
    for (let n = 0; n < N; n++) {
      let p = newProject('Fuzz');
      let x = ri(0, 200);
      const count = ri(2, 5);
      for (let i = 0; i < count; i++) {
        const d = cab(t('base-door'), {
          bottom: pick(['under', 'between'] as const),
          plinthHeight: pick([100, 120]),
          width: pick([400, 500, 600]),
          depth: pick([560, 560, 580]),
        });
        const it = makeItem(p, d);
        p = { ...p, items: [...p.items, { ...it, position: { ...it.position, x } }] };
        const w = d.product.kind === 'cabinet' ? d.product.params.width : 0;
        x += w + (rnd() < 0.5 ? 0 : ri(0, 150));
      }
      const q: Project = {
        ...p,
        runSettings: { scribe: pick([0, 20]), auto: false },
        runParts: suggestRunParts(p),
      };
      const pm = buildProjectModel(q);
      const where = JSON.stringify(q.items.map((i) => i.position.x));
      if (pm.diagnostics.some((d) => d.severity === 'error')) continue;
      const pieceSet = pm.pieces.flatMap((pc) => pc.panels);
      const runPanels = pm.model.panels.filter((pp) => pp.id.startsWith('run:'));
      expect(runPanels.length, where).toBe(q.runParts!.length);
      for (const rp of runPanels)
        for (const pp of pieceSet)
          expect(panelsOverlap(rp, pp), `${rp.label} × ${pp.id} ${where}`).toBe(false);
      for (const rp of q.runParts!.filter((r) => r.kind === 'plinth')) {
        plinths++;
        const src = pm.pieces.filter((pc) => rp.from!.includes(pc.item.id));
        const x0 = Math.min(...src.map((pc) => pc.bounds.x));
        const x1 = Math.max(...src.map((pc) => pc.bounds.x + pc.bounds.w));
        expect(rp.box.x, where).toBe(x0);
        expect(rp.box.w, where).toBe(x1 - x0);
      }
    }
    expect(plinths).toBeGreaterThan(0);
  });
});

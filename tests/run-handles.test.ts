// Run handles and sinks (ADR-125): one handle on every front of a run on one line, overrides, refresh, removal;
// a sink's worktop cut-out in the cut list, the shopping list and the checks; the project document (ADR-011).
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import {
  applyRunHandles,
  buildProjectModel,
  makeItem,
  newProject,
  PROJECT_SCHEMA,
  projectCutlist,
  projectHardware,
  pruneRunExtras,
  sinkList,
  suggestRunParts,
  validateProject,
  type Project,
  type RunHandle,
} from '../src/core/project';
import { shoppingList } from '../src/core/shopping';
import type { CabinetParams, Design, Panel } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const cab = (d: Design, patch: Partial<CabinetParams>): Design =>
  d.product.kind === 'cabinet'
    ? { ...d, product: { ...d.product, params: { ...d.product.params, ...patch } } }
    : d;
const drawers = () => cab(t('base-door'), { interior: { id: 'dr', kind: 'drawers', count: 3 } });

/** Base units side by side on the floor, left to right. */
function run(designs: Design[]): Project {
  let p = newProject('Run');
  for (const d of designs) p = { ...p, items: [...p.items, makeItem(p, d)] };
  return p;
}
const bar = (from: string[], patch: Partial<RunHandle> = {}): RunHandle => ({
  id: 'rh1',
  from,
  handle: { kind: 'bar', holeSpacing: 128 },
  height: 600,
  ...patch,
});
const fronts = (p: Project) =>
  buildProjectModel(p).model.panels.filter((x) => x.role === 'door' || x.role === 'drawer-front');
const pieceOf = (x: Panel) => x.id.split(':')[0];
/** Room height of a front's handle-hole centre (mean of its holes), or null without holes. */
const holeHeight = (x: Panel) => {
  if (!x.handleHoles) return null;
  const vs = x.handleHoles.at.map(([, v]) => v);
  return x.box.y + vs.reduce((a, b) => a + b, 0) / vs.length;
};

describe('run handles (ADR-125)', () => {
  it('every front in the run gets the run handle on one line; the designs keep their own handles', () => {
    const p0 = run([t('base-door'), t('base-door'), t('base-door')]);
    expect(fronts(p0).every((x) => !x.handleHoles)).toBe(true);
    const p = { ...p0, runHandles: [bar(p0.items.map((i) => i.id))] };
    const fs = fronts(p);
    expect(fs).toHaveLength(3);
    for (const f of fs) expect(holeHeight(f)).toBe(600);
    // Built only: the stored designs are unchanged, so removing the run handle gives each piece its own back.
    expect(p.items.map((i) => i.design)).toEqual(p0.items.map((i) => i.design));
    expect(applyRunHandles(p0)).toBe(p0);
    const hw = projectHardware(p).filter((h) => h.kind === 'handle');
    expect(hw.reduce((n, h) => n + h.quantity, 0)).toBe(3);
    expect(hw[0].label).toBe('Bar handle, 128 mm centres');
  });

  it('an overridden piece keeps its own handles', () => {
    const p0 = run([t('base-door'), t('base-door'), t('base-door')]);
    const ids = p0.items.map((i) => i.id);
    const p = { ...p0, runHandles: [bar(ids, { own: [ids[1]] })] };
    const fs = fronts(p);
    expect(fs.filter((x) => pieceOf(x) === ids[1]).every((x) => !x.handleHoles)).toBe(true);
    for (const f of fs.filter((x) => pieceOf(x) !== ids[1])) expect(holeHeight(f)).toBe(600);
  });

  it('fronts the line does not cross get the handle near their top; Top of fronts lines up the tops', () => {
    const p0 = run([drawers(), t('base-door')]);
    const ids = p0.items.map((i) => i.id);
    const p = { ...p0, runHandles: [bar(ids, { handle: { kind: 'knob' }, height: 400 })] };
    const fs = fronts(p);
    const drawerFronts = fs.filter((x) => x.role === 'drawer-front');
    expect(drawerFronts).toHaveLength(3);
    const crossed = drawerFronts.filter(
      (x) => x.box.y + 20 <= 400 && x.box.y + x.box.h - 20 >= 400,
    );
    expect(crossed.length).toBe(1);
    for (const f of crossed) expect(holeHeight(f)).toBe(400);
    for (const f of drawerFronts.filter((x) => !crossed.includes(x)))
      expect(holeHeight(f)).toBe(f.box.y + f.box.h - 40);
    const top = { ...p0, runHandles: [bar(ids, { handle: { kind: 'knob' }, height: undefined })] };
    for (const f of fronts(top).filter((x) => x.role === 'drawer-front'))
      expect(holeHeight(f)).toBe(f.box.y + f.box.h - 40);
  });

  it('a piece added to the run gets the handle; parts and cut list follow', () => {
    const p0 = run([t('base-door'), t('base-door')]);
    const p1 = { ...p0, runHandles: [bar(p0.items.map((i) => i.id))] };
    const p = { ...p1, items: [...p1.items, makeItem(p1, t('base-door'))] };
    const fs = fronts(p);
    expect(fs).toHaveLength(3);
    for (const f of fs) expect(holeHeight(f)).toBe(600);
    expect(projectCutlist(p).some((r) => /handle holes/.test(r.drilling))).toBe(true);
  });

  it('a removed run handle stays removed; deleted pieces leave run handles and sinks', () => {
    const p0 = run([t('base-door'), t('base-door')]);
    const ids = p0.items.map((i) => i.id);
    const p = {
      ...p0,
      schemaVersion: 13 as const,
      runHandles: [bar(ids)],
      sinks: [{ id: 's1', baseId: ids[0], w: 500, d: 400 }],
    };
    const pruned = pruneRunExtras({ ...p, items: p.items.slice(1) });
    expect(pruned.sinks).toEqual([]);
    expect(pruned.runHandles![0].from).toEqual([ids[1]]);
    expect(pruneRunExtras(p)).toBe(p);
  });
});

describe('run handles in the store (ADR-125)', () => {
  beforeEach(() => {
    const p = run([t('base-door'), t('base-door')]);
    useDesign.setState({ project: p, projectModel: buildProjectModel(p), editingItemId: null });
  });
  it('adding and removing are one undo step each; suggesting run parts never brings a removed one back', () => {
    const st = useDesign.getState();
    const ids = st.project!.items.map((i) => i.id);
    st.setRunHandle(bar(ids));
    expect(useDesign.getState().project!.runHandles).toHaveLength(1);
    // An edited project is saved at the current project version (13 when ADR-125 shipped).
    expect(useDesign.getState().project!.schemaVersion).toBe(PROJECT_SCHEMA);
    useDesign.getState().removeRunHandle('rh1');
    expect(useDesign.getState().project!.runHandles).toBeUndefined();
    useDesign.getState().suggestRunParts();
    expect(useDesign.getState().project!.runHandles).toBeUndefined();
    useDesign.getState().undoProject();
    useDesign.getState().undoProject();
    expect(useDesign.getState().project!.runHandles).toHaveLength(1);
  });
});

describe('run sinks (ADR-125)', () => {
  const withTop = () => {
    const p0 = run([t('base-door'), t('base-door')]);
    return { ...p0, runParts: suggestRunParts(p0) };
  };
  it('a sink over the chosen base is a note on the worktop row and a shopping line with the user size', () => {
    const p0 = withTop();
    const p = { ...p0, sinks: [{ id: 's1', baseId: p0.items[1].id, w: 500, d: 400 }] };
    const rows = projectCutlist(p);
    const top = rows.find((r) => r.labels.some((l) => l.startsWith('Run: Worktop')))!;
    expect(top.labels.join()).toContain('sink cut-out 500 × 400 mm');
    const lines = shoppingList({
      rows,
      materials: [],
      hardware: [],
      sheets: null,
      sinks: sinkList(p),
    });
    const sink = lines.find((l) => l.label === 'Sink (your choice)')!;
    expect(sink.section).toBe('choose');
    expect(sink.detail).toBe(`cut-out 500 × 400 mm in the worktop over ${p0.items[1].design.name}`);
    expect(buildProjectModel(p).diagnostics.filter((d) => d.code.startsWith('sink-'))).toEqual([]);
  });

  it('checks: no worktop, wider than the base, as deep as the worktop (error)', () => {
    const bare = run([t('base-door')]);
    const id = bare.items[0].id;
    const codes = (p: Project) =>
      buildProjectModel(p)
        .diagnostics.filter((d) => d.code.startsWith('sink-'))
        .map((d) => `${d.severity}:${d.code}`);
    expect(codes({ ...bare, sinks: [{ id: 's', baseId: id, w: 500, d: 400 }] })).toEqual([
      'warning:sink-no-worktop',
    ]);
    const p0 = withTop();
    const top = p0.runParts.find((r) => r.kind === 'worktop')!;
    const b = p0.items[0].id;
    expect(codes({ ...p0, sinks: [{ id: 's', baseId: b, w: 700, d: top.box.d }] })).toEqual([
      'error:sink-cutout-deep',
      'warning:sink-cutout-wide',
    ]);
  });
});

describe('project document (ADR-011, ADR-125)', () => {
  it('schemaVersion 13 stores run handles and sinks; older versions still load and refuse them', () => {
    const p0 = run([t('base-door')]);
    const id = p0.items[0].id;
    const extras = {
      runHandles: [bar([id])],
      sinks: [{ id: 's', baseId: id, w: 500, d: 400 }],
    };
    expect(validateProject({ ...p0, schemaVersion: 13, ...extras })).toEqual([]);
    expect(validateProject({ ...p0, schemaVersion: 9 })).toEqual([]);
    expect(validateProject({ ...p0, schemaVersion: 9, ...extras })).toContain(
      'Run handles and sinks need project schemaVersion 13',
    );
    expect(
      validateProject({
        ...p0,
        schemaVersion: 13,
        runHandles: [bar([id], { handle: { kind: 'bar', holeSpacing: 130 } })],
      }),
    ).toContain('Invalid run handle');
    expect(
      validateProject({
        ...p0,
        schemaVersion: 13,
        sinks: [{ id: 's', baseId: 'gone', w: 1, d: 1 }],
      }),
    ).toContain('Invalid sink');
  });
});

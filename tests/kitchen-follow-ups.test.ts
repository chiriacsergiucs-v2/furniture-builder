// ADR-209: kitchen run follow-ups — moulding profiles, templates keeping run requests, placed cut-outs and their holes
// in 3D, worktop edge profiles, run requests following variables, formula comparisons / if / round(x, step), the
// filler repair as a run request kept by automatic refresh, fastener edge distances and drilling positions, documents.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { templates } from '../src/core/design';
import {
  fixingNote,
  fixingPositions,
  fixingSpots,
  validFastenerChoice,
  type FastenerChoice,
} from '../src/core/fasteners';
import { setPrintLang } from '../src/core/i18n/print';
import { insertTemplate } from '../src/core/insertTemplate';
import {
  buildProjectModel,
  cutoutOutlines,
  makeItem,
  newProject,
  parseProfile,
  placeItem,
  planRuns,
  profileBounds,
  profileValid,
  PROJECT_SCHEMA,
  projectCutlist,
  pruneWorktopEdges,
  refreshRunParts,
  remakeAskedParts,
  requestKey,
  resolvePlacements,
  runPartKey,
  suggestRunParts,
  validateProject,
  type Project,
  type RunPart,
  type RunRequest,
} from '../src/core/project';
import {
  projectFromTemplate,
  remapRunRequests,
  TEMPLATE_SCHEMA,
  templateFromProject,
  validateProjectTemplate,
} from '../src/core/projectTemplate';
import { repairsFor, settle } from '../src/core/repairs';
import { drillingRo } from '../src/core/ro';
import type { Material, Panel } from '../src/core/types';
import {
  addVariable,
  applyBindings,
  deleteVariable,
  evaluateExpr,
  nameProblem,
  updateVariable,
  variableDiagnostics,
} from '../src/core/variables';
import { db, deleteFastener, listFasteners, saveFastener } from '../src/persist/db';
import { useDesign } from '../src/store/designStore';

const tpl = (id: string) => templates.find((x) => x.id === id)!.create();
const st = () => useDesign.getState();

function row(template: string, n: number): Project {
  let p = newProject('Run');
  for (let i = 0; i < n; i++) p = { ...p, items: [...p.items, makeItem(p, tpl(template))] };
  return p;
}
const board = (p: Project): Material => p.items[0].design.materials[0];
/** Requests planned with automatic refresh on, as the store does. */
const planned = (p: Project, rs: RunRequest[]): Project => {
  const q: Project = { ...p, runRequests: rs, runSettings: { scribe: 0, auto: true } };
  return { ...q, runParts: planRuns(q).parts };
};
const runPanel = (p: Project, key: string): Panel =>
  buildProjectModel(p).model.panels.find((x) => x.id === `run:${key}`)!;
const errors = (p: Project) =>
  buildProjectModel(p).diagnostics.filter((d) => d.severity === 'error');
const codes = (p: Project) => buildProjectModel(p).diagnostics.map((d) => d.code);
const rowOf = (p: Project, label: string) =>
  projectCutlist(p).find((r) => r.labels.some((l) => l === label))!;

/** Two base units with the suggested run worktop (1218 × 38 × 598 over x 0..1218, z 0..598). */
function kitchen(): { p: Project; wt: RunPart } {
  const p0 = row('base-door', 2);
  const p = { ...p0, runParts: suggestRunParts(p0) };
  return { p, wt: p.runParts!.find((r) => r.kind === 'worktop')! };
}

afterEach(() => setPrintLang('ro'));

// ---------------------------------------------------------------------------
// 1. Mouldings with a profile
// ---------------------------------------------------------------------------

describe('moulding profiles (ADR-209 item 1)', () => {
  const walls = () => row('wall-cabinet', 2);
  const PROFILE: [number, number][] = [
    [0, 0],
    [20, 0],
    [20, 45],
    [0, 60],
  ];

  it('parses typed points and checks the shape', () => {
    expect(parseProfile('0,0; 20,0; 20,45; 0,60')).toEqual(PROFILE);
    expect(parseProfile('0,0; 20')).toBeNull();
    expect(parseProfile('0.5,0; 20,0; 20,45')).toBeNull();
    expect(profileBounds(PROFILE)).toEqual({ u: 0, v: 0, w: 20, h: 60 });
    expect(profileValid(PROFILE)).toBe(true);
    // Fewer than three points, a repeated point, crossing edges, no area.
    expect(
      profileValid([
        [0, 0],
        [20, 0],
      ]),
    ).toBe(false);
    expect(
      profileValid([
        [0, 0],
        [20, 0],
        [20, 0],
        [0, 60],
      ]),
    ).toBe(false);
    expect(
      profileValid([
        [0, 0],
        [20, 20],
        [20, 0],
        [0, 20],
      ]),
    ).toBe(false);
    expect(
      profileValid([
        [0, 0],
        [10, 0],
        [20, 0],
      ]),
    ).toBe(false);
  });

  it('a crown with a typed profile takes its bounding size, its note and its 3D section', () => {
    const p0 = walls();
    const ids = p0.items.map((i) => i.id);
    const m = board(p0);
    // Offset points: the section is moved to start at 0, 0; no height typed, the profile gives it.
    const shifted: [number, number][] = PROFILE.map(([u, v]) => [u + 5, v + 7]);
    const p = planned(p0, [{ kind: 'crown', from: ids, material: m, profile: shifted }]);
    const crown = p.runParts!.find((r) => r.kind === 'crown')!;
    const b = buildProjectModel(p).pieces.map((pc) => pc.bounds);
    const front = Math.max(...b.map((x) => x.z + x.d));
    expect(crown.box).toEqual({
      x: b[0].x,
      y: b[0].y + b[0].h,
      z: front - 20,
      w: b[0].w + b[1].w,
      h: 60,
      d: 20,
    });
    expect(errors(p)).toEqual([]);
    expect(runPanel(p, crown.id).section).toEqual(PROFILE);
    const cut = rowOf(p, 'Run: Crown');
    expect(cut.drilling).toContain('profile 20 × 60 mm, drawn by you');
    expect(drillingRo(cut.drilling)).toContain('profil 20 × 60 mm, desenat de tine');
    setPrintLang('ru');
    expect(drillingRo(cut.drilling)).toContain('профиль 20 × 60 мм, нарисован вами');
    setPrintLang('en');
    expect(drillingRo(cut.drilling)).toContain('profile 20 × 60 mm, drawn by you');
  });

  it('a pelmet with a profile hangs its bounding height under the units', () => {
    const p0 = walls();
    const ids = p0.items.map((i) => i.id);
    const p = planned(p0, [{ kind: 'pelmet', from: ids, material: board(p0), profile: PROFILE }]);
    const pelmet = p.runParts!.find((r) => r.kind === 'pelmet')!;
    const b = buildProjectModel(p).pieces[0].bounds;
    expect([pelmet.box.y, pelmet.box.h, pelmet.box.d]).toEqual([b.y - 60, 60, 20]);
    expect(runPanel(p, pelmet.id).section).toEqual(PROFILE);
  });

  it('without a profile the trim stays a plain strip of its height and board', () => {
    const p0 = walls();
    const m = board(p0);
    const p = planned(p0, [
      { kind: 'crown', from: p0.items.map((i) => i.id), height: 60, material: m },
    ]);
    const crown = p.runParts!.find((r) => r.kind === 'crown')!;
    expect([crown.box.h, crown.box.d]).toEqual([60, m.thickness]);
    expect(runPanel(p, crown.id).section).toBeUndefined();
    expect(rowOf(p, 'Run: Crown').drilling ?? '').not.toContain('profile');
  });

  it('a crossing profile or one of two points is the error trim-profile-invalid; no section or note', () => {
    const p0 = walls();
    const ids = p0.items.map((i) => i.id);
    const bow: [number, number][] = [
      [0, 0],
      [20, 20],
      [20, 0],
      [0, 20],
    ];
    const p = planned(p0, [
      { kind: 'crown', from: ids, height: 60, material: board(p0), profile: bow },
    ]);
    const d = buildProjectModel(p).diagnostics.filter((x) => x.code === 'trim-profile-invalid');
    expect(d).toHaveLength(1);
    expect(d[0].severity).toBe('error');
    expect(d[0].message).toMatch(
      /^The profile of Crown over .* crosses itself or has fewer than three points\.$/,
    );
    const crown = p.runParts!.find((r) => r.kind === 'crown')!;
    expect(runPanel(p, crown.id).section).toBeUndefined();
    expect(rowOf(p, 'Run: Crown').drilling ?? '').not.toContain('profile');
    const two = planned(p0, [
      {
        kind: 'pelmet',
        from: ids,
        height: 40,
        material: board(p0),
        profile: [
          [0, 0],
          [20, 40],
        ],
      },
    ]);
    expect(codes(two)).toContain('trim-profile-invalid');
  });

  it('documents: a profile only on a crown or pelmet, whole-mm points', () => {
    const p0 = walls();
    const ids = p0.items.map((i) => i.id);
    const ok = planned(p0, [{ kind: 'crown', from: ids, material: board(p0), profile: PROFILE }]);
    expect(validateProject(ok)).toEqual([]);
    const onWorktop = {
      ...ok,
      runRequests: [{ kind: 'worktop' as const, from: ids, profile: PROFILE }],
    };
    expect(validateProject(onWorktop)).toContain('Invalid run request');
    const half = {
      ...ok,
      runRequests: [{ ...ok.runRequests![0], profile: [[0.5, 0] as [number, number], ...PROFILE] }],
    };
    expect(validateProject(half)).toContain('Invalid run request');
  });
});

// ---------------------------------------------------------------------------
// 2. Templates keep run requests
// ---------------------------------------------------------------------------

describe('templates keep run requests (ADR-209 item 2)', () => {
  const PROFILE: [number, number][] = [
    [0, 0],
    [20, 0],
    [20, 45],
    [0, 60],
  ];
  function source(): Project {
    const p0 = row('wall-cabinet', 2);
    const ids = p0.items.map((i) => i.id);
    return planned(p0, [
      { kind: 'crown', from: ids, material: board(p0), profile: PROFILE },
      { kind: 'pelmet', from: [ids[0]], height: 40, material: board(p0) },
    ]);
  }

  it('remapRunRequests maps every piece id; a request over a piece not mapped is dropped', () => {
    const p = source();
    const [a, b] = p.items.map((i) => i.id);
    const ids = new Map([
      [a, 'A'],
      [b, 'B'],
    ]);
    const out = remapRunRequests(p.runRequests, ids);
    expect(out.map((r) => [r.kind, r.from])).toEqual([
      ['crown', ['A', 'B']],
      ['pelmet', ['A']],
    ]);
    expect(out[0].profile).toEqual(PROFILE);
    // A copy, not the same arrays.
    expect(out[0].profile).not.toBe(p.runRequests![0].profile);
    expect(remapRunRequests(p.runRequests, new Map([[a, 'A']])).map((r) => r.kind)).toEqual([
      'pelmet',
    ]);
  });

  it('templateFromProject keeps them over template refs at the current template version', () => {
    const p = source();
    const tp = templateFromProject(p, 'Wall run');
    expect(tp.schemaVersion).toBe(TEMPLATE_SCHEMA);
    expect(tp.runRequests).toHaveLength(2);
    const refs = new Set(tp.items.map((i) => i.ref));
    expect(tp.runRequests!.every((r) => r.from.every((x) => refs.has(x)))).toBe(true);
    expect(validateProjectTemplate(tp)).toEqual([]);
    // A template without requests does not carry the field.
    expect(templateFromProject(row('wall-cabinet', 2), 'Plain').runRequests).toBeUndefined();
  });

  it('projectFromTemplate gives the requests the new piece ids; the trims are made again', () => {
    const p = source();
    const made = projectFromTemplate(templateFromProject(p, 'Wall run'));
    const newIds = made.items.map((i) => i.id);
    expect(newIds.some((id) => p.items.some((i) => i.id === id))).toBe(false);
    expect(made.runRequests!.map((r) => [r.kind, r.from])).toEqual([
      ['crown', newIds],
      ['pelmet', [newIds[0]]],
    ]);
    expect(made.runRequests![0].profile).toEqual(PROFILE);
    expect(validateProject(made)).toEqual([]);
    const again = planned(made, made.runRequests!);
    expect(again.runParts!.find((r) => r.kind === 'crown')!.box.h).toBe(60);
  });

  it('insertTemplate adds them over the inserted pieces, next to the project’s own', () => {
    const p = source();
    const tp = templateFromProject(p, 'Wall run');
    const host = source();
    const res = insertTemplate(host, tp);
    expect(res.project.runRequests).toHaveLength(4);
    const added = res.project.runRequests!.slice(2);
    expect(added.map((r) => r.from)).toEqual([res.ids, [res.ids[0]]]);
    expect(added.every((r) => r.from.every((id) => !host.items.some((i) => i.id === id)))).toBe(
      true,
    );
    expect(res.project.runRequests!.slice(0, 2)).toEqual(host.runRequests);
  });

  it('a template’s run request over an unknown ref is refused', () => {
    const tp = templateFromProject(source(), 'Wall run');
    const bad = { ...tp, runRequests: [{ ...tp.runRequests![0], from: ['nope'] }] };
    expect(validateProjectTemplate(bad)).toContain('Invalid template run request');
  });
});

// ---------------------------------------------------------------------------
// 3–4. Cut-out positions and holes in 3D
// ---------------------------------------------------------------------------

describe('cut-out positions and holes (ADR-209 items 3 and 4)', () => {
  const outlines = (p: Project) =>
    cutoutOutlines(
      p,
      resolvePlacements(p).items.map((i) => placeItem(i)),
    );

  it('absent offsets stay centred; typed ones move the outline from the base’s left and the worktop’s front', () => {
    const { p, wt } = kitchen();
    const [a, b] = p.items;
    const ba = placeItem(a).bounds,
      bb = placeItem(b).bounds;
    const q: Project = {
      ...p,
      sinks: [{ id: 's1', baseId: b.id, w: 500, d: 400 }],
      hobs: [{ id: 'h1', baseId: a.id, w: 560, d: 490, x: 10, z: 50 }],
    };
    const [sink, hob] = outlines(q);
    // Centred: (600 − 500) / 2 along the base; (598 − 400) / 2 across the worktop.
    expect(sink).toMatchObject({ x: 50, z: 99, placed: false, partId: wt.id });
    expect(sink.box).toMatchObject({ x: bb.x + 50, z: wt.box.z + 99, w: 500, d: 400 });
    // Placed: 10 mm from the base's left edge, 50 mm from the worktop's front edge.
    expect(hob).toMatchObject({ x: 10, z: 50, placed: true });
    expect(hob.box).toMatchObject({
      x: ba.x + 10,
      z: wt.box.z + wt.box.d - 50 - 490,
      w: 560,
      d: 490,
    });
    expect(codes(q).filter((c) => /cutout/.test(c))).toEqual([]);
  });

  it('the cut-list note says where a placed cut-out is, in ro, ru and en; a centred one keeps ADR-205’s note', () => {
    const { p } = kitchen();
    const [a, b] = p.items;
    const q: Project = {
      ...p,
      sinks: [{ id: 's1', baseId: b.id, w: 500, d: 400, x: 40 }],
      hobs: [{ id: 'h1', baseId: a.id, w: 560, d: 490 }],
    };
    const note = rowOf(q, 'Run: Worktop').drilling;
    // x typed, z centred: from the front it is (598 − 400) − 99.
    expect(note).toContain('sink cut-out 500 × 400 mm at 40 mm from left and 99 mm from front');
    expect(note).toContain('hob cut-out 560 × 490 mm');
    expect(note).not.toMatch(/hob cut-out 560 × 490 mm at/);
    expect(drillingRo(note)).toContain(
      'decupaj chiuvetă 500 × 400 mm, la 40 mm de stânga și 99 mm de față',
    );
    expect(drillingRo(note)).toContain('decupaj plită 560 × 490 mm');
    setPrintLang('ru');
    expect(drillingRo(note)).toContain(
      'вырез под мойку 500 × 400 мм, в 40 мм от левого края и 99 мм от переднего',
    );
    setPrintLang('en');
    expect(drillingRo(note)).toContain(
      'sink cut-out 500 × 400 mm, 40 mm from the left and 99 mm from the front',
    );
  });

  it('wide and deep checks count the offset with the size, and say so', () => {
    const { p } = kitchen();
    const b = p.items[1];
    const at = (x?: number, z?: number) =>
      buildProjectModel({
        ...p,
        sinks: [
          {
            id: 's1',
            baseId: b.id,
            w: 500,
            d: 400,
            ...(x !== undefined ? { x } : {}),
            ...(z !== undefined ? { z } : {}),
          },
        ],
      }).diagnostics.filter((d) => d.code.startsWith('sink-cutout'));
    // 100 + 500 = 600 fits the 600 mm base exactly; 101 goes past it.
    expect(at(100)).toEqual([]);
    const wide = at(101);
    expect(wide.map((d) => [d.code, d.severity])).toEqual([['sink-cutout-wide', 'warning']]);
    expect(wide[0].message).toMatch(/^Sink cut-out 500 mm wide at 101 mm from the left goes past/);
    // 197 + 400 = 597 < 598; 198 + 400 reaches the back.
    expect(at(undefined, 197)).toEqual([]);
    const deep = at(undefined, 198);
    expect(deep.map((d) => [d.code, d.severity])).toEqual([['sink-cutout-deep', 'error']]);
    expect(deep[0].message).toMatch(/^Sink cut-out 400 mm deep at 198 mm from the front reaches/);
    // Hobs are checked the same way.
    const hob = buildProjectModel({
      ...p,
      hobs: [{ id: 'h1', baseId: b.id, w: 560, d: 490, x: 50, z: 120 }],
    }).diagnostics.map((d) => d.code);
    expect(hob).toEqual(expect.arrayContaining(['hob-cutout-wide', 'hob-cutout-deep']));
  });

  it('the 3D worktop has a hole per cut-out at its outline; no shape note is added', () => {
    const { p, wt } = kitchen();
    const [a, b] = p.items;
    const plain = rowOf(p, 'Run: Worktop').drilling ?? '';
    expect(runPanel(p, wt.id).shape).toBeUndefined();
    const q: Project = {
      ...p,
      sinks: [{ id: 's1', baseId: b.id, w: 500, d: 400 }],
      hobs: [{ id: 'h1', baseId: a.id, w: 560, d: 490, x: 10, z: 50 }],
    };
    const panel = runPanel(q, wt.id);
    expect(panel.shape?.kind).toBe('profile');
    const shape = panel.shape as Extract<NonNullable<Panel['shape']>, { kind: 'profile' }>;
    expect(shape.points).toEqual([
      [0, 0],
      [wt.box.w, 0],
      [wt.box.w, wt.box.d],
      [0, wt.box.d],
    ]);
    const [o1, o2] = outlines(q);
    const hole = (o: (typeof o1)['box']): [number, number][] => [
      [o.x - wt.box.x, o.z - wt.box.z],
      [o.x - wt.box.x + o.w, o.z - wt.box.z],
      [o.x - wt.box.x + o.w, o.z - wt.box.z + o.d],
      [o.x - wt.box.x, o.z - wt.box.z + o.d],
    ];
    expect(shape.holes).toEqual([hole(o1.box), hole(o2.box)]);
    // The cut-list row: only ADR-205's cut-out notes (no shape note) and the blank size is unchanged.
    const r = rowOf(q, 'Run: Worktop');
    expect(r.drilling.replace(plain, '')).not.toMatch(/profile|shape|contur/);
    expect([r.length, r.width]).toEqual([
      rowOf(p, 'Run: Worktop').length,
      rowOf(p, 'Run: Worktop').width,
    ]);
  });

  it('documents: offsets are whole mm from 0 to 3000', () => {
    const { p } = kitchen();
    const b = p.items[1];
    const ok = { ...p, sinks: [{ id: 's1', baseId: b.id, w: 500, d: 400, x: 0, z: 3000 }] };
    expect(validateProject(ok)).toEqual([]);
    expect(
      validateProject({ ...p, sinks: [{ id: 's1', baseId: b.id, w: 500, d: 400, x: -1 }] }),
    ).toContain('Invalid sink');
    expect(
      validateProject({ ...p, hobs: [{ id: 'h1', baseId: b.id, w: 500, d: 400, z: 3001 }] }),
    ).toContain('Invalid hob');
  });
});

// ---------------------------------------------------------------------------
// 5. Worktop edge profiles
// ---------------------------------------------------------------------------

describe('worktop edge profiles (ADR-209 item 5)', () => {
  const edged = (kind: 'square' | 'rounded' | 'bevel', size?: number) => {
    const { p, wt } = kitchen();
    const key = runPartKey(wt);
    return {
      p: {
        ...p,
        worktopEdges: [{ key, kind, ...(size !== undefined ? { size } : {}) }],
      } as Project,
      wt,
    };
  };

  it('rounded and bevelled edges are drawn in 3D on the front face, with their print note in ro, ru and en', () => {
    const r = edged('rounded', 10);
    expect(runPanel(r.p, r.wt.id).edgeProfile).toEqual({ kind: 'rounded', size: 10, face: '+z' });
    const rn = rowOf(r.p, 'Run: Worktop').drilling;
    expect(rn).toContain('rounded edge R10 mm');
    expect(drillingRo(rn)).toContain('cant rotunjit R10 mm');
    const b = edged('bevel', 6);
    expect(runPanel(b.p, b.wt.id).edgeProfile).toEqual({ kind: 'bevel', size: 6, face: '+z' });
    const bn = rowOf(b.p, 'Run: Worktop').drilling;
    expect(bn).toContain('bevelled edge 6 mm');
    expect(drillingRo(bn)).toContain('cant teșit 6 mm');
    setPrintLang('ru');
    expect(drillingRo(rn)).toContain('скруглённая кромка R10 мм');
    expect(drillingRo(bn)).toContain('скошенная кромка 6 мм');
    setPrintLang('en');
    expect(drillingRo(rn)).toContain('rounded edge R10 mm');
    expect(drillingRo(bn)).toContain('bevelled edge 6 mm');
    expect(codes(r.p)).not.toContain('worktop-edge-size');
    expect(codes(b.p)).not.toContain('worktop-edge-size');
  });

  it('square or absent: no edge drawn, no note, no warning', () => {
    const s = edged('square');
    expect(runPanel(s.p, s.wt.id).edgeProfile).toBeUndefined();
    expect(rowOf(s.p, 'Run: Worktop').drilling ?? '').not.toMatch(/edge/);
    expect(codes(s.p)).not.toContain('worktop-edge-size');
    const { p, wt } = kitchen();
    expect(runPanel(p, wt.id).edgeProfile).toBeUndefined();
  });

  it('rounded or bevelled without a size, or one not under the thickness, warns worktop-edge-size and draws square', () => {
    for (const [kind, size] of [
      ['rounded', undefined],
      ['bevel', undefined],
      ['rounded', 38],
      ['bevel', 50],
    ] as const) {
      const e = edged(kind, size);
      const d = buildProjectModel(e.p).diagnostics.filter((x) => x.code === 'worktop-edge-size');
      expect(d.map((x) => x.severity)).toEqual(['warning']);
      expect(runPanel(e.p, e.wt.id).edgeProfile).toBeUndefined();
      expect(rowOf(e.p, 'Run: Worktop').drilling ?? '').not.toMatch(/edge/);
    }
    // 37 mm on a 38 mm worktop is drawn.
    const fits = edged('rounded', 37);
    expect(fits.wt.material.thickness).toBe(38);
    expect(runPanel(fits.p, fits.wt.id).edgeProfile?.size).toBe(37);
  });

  it('an edge goes with its worktop; documents check the kind and size', () => {
    const e = edged('rounded', 10);
    expect(validateProject(e.p)).toEqual([]);
    expect(pruneWorktopEdges(e.p)).toBe(e.p);
    const gone = pruneWorktopEdges({ ...e.p, runParts: [] });
    expect(gone.worktopEdges).toBeUndefined();
    const k = e.p.worktopEdges![0].key;
    expect(validateProject({ ...e.p, worktopEdges: [{ key: k, kind: 'ogee' }] })).toContain(
      'Invalid worktop edge',
    );
    expect(
      validateProject({ ...e.p, worktopEdges: [{ key: k, kind: 'rounded', size: 0 }] }),
    ).toContain('Invalid worktop edge');
    expect(
      validateProject({
        ...e.p,
        worktopEdges: [
          { key: k, kind: 'rounded', size: 4 },
          { key: k, kind: 'bevel', size: 4 },
        ],
      }),
    ).toContain('Invalid worktop edge');
  });
});

// ---------------------------------------------------------------------------
// 6–7. Run requests follow variables; conditions and stepped rounding
// ---------------------------------------------------------------------------

describe('run requests follow variables (ADR-209 item 6)', () => {
  function setup() {
    const p0 = row('base-door', 2);
    const ids = p0.items.map((i) => i.id);
    const v = addVariable(p0, 'overhang', '30');
    const p = planned(v.project, [
      { kind: 'worktop', from: ids, front: 20, bindings: [{ target: 'front', expr: 'overhang' }] },
    ]);
    return { p, id: v.id, ids };
  }
  const depth = (p: Project) => planRuns(p).parts.find((r) => r.kind === 'worktop')!.box.d;

  it('a bound worktop overhang follows its variable; a change reaches the worktop', () => {
    const { p, id } = setup();
    const bound = applyBindings(p);
    expect(bound.runRequests![0].front).toBe(30);
    const d30 = depth(bound);
    const changed = applyBindings(updateVariable(bound, id, { expr: '45' }));
    expect(changed.runRequests![0].front).toBe(45);
    expect(depth(changed)).toBe(d30 + 15);
    expect(variableDiagnostics(changed)).toEqual([]);
  });

  it('a side overhang and a crown height follow too', () => {
    const p0 = row('wall-cabinet', 2);
    const ids = p0.items.map((i) => i.id);
    let p = addVariable(p0, 'crown h', '80').project;
    p = planned(p, [
      {
        kind: 'crown',
        from: ids,
        height: 60,
        material: board(p0),
        bindings: [{ target: 'height', expr: 'crown h' }],
      },
    ]);
    const bound = applyBindings(p);
    expect(bound.runRequests![0].height).toBe(80);
    expect(planRuns(bound).parts.find((r) => r.kind === 'crown')!.box.h).toBe(80);
    const b0 = row('base-door', 2);
    let w = addVariable(b0, 'side', '15').project;
    w = planned(w, [
      {
        kind: 'worktop',
        from: b0.items.map((i) => i.id),
        bindings: [{ target: 'side', expr: 'side * 2' }],
      },
    ]);
    expect(applyBindings(w).runRequests![0].side).toBe(30);
  });

  it('problems are error diagnostics and the field keeps its number', () => {
    const { p } = setup();
    const bad = applyBindings({
      ...p,
      runRequests: [{ ...p.runRequests![0], bindings: [{ target: 'front', expr: 'nope + 1' }] }],
    });
    expect(bad.runRequests![0].front).toBe(20);
    const d = variableDiagnostics(bad);
    expect(d.map((x) => [x.code, x.severity])).toEqual([['binding-problem', 'error']]);
    const far = applyBindings({
      ...p,
      runRequests: [{ ...p.runRequests![0], bindings: [{ target: 'front', expr: '5000' }] }],
    });
    expect(far.runRequests![0].front).toBe(20);
    const r = variableDiagnostics(far);
    expect(r.map((x) => [x.code, x.severity])).toEqual([['binding-range', 'error']]);
    expect(r[0].message).toMatch(/The field keeps 20 mm\.$/);
    // Errors of the project too, so export is blocked.
    expect(buildProjectModel(far).diagnostics.map((x) => x.code)).toContain('binding-range');
  });

  it('renaming a variable carries into the binding; deleting it unbinds and keeps the number', () => {
    const { p, id } = setup();
    const bound = applyBindings(p);
    const renamed = updateVariable(bound, id, { name: 'front lip' });
    expect(renamed.runRequests![0].bindings).toEqual([{ target: 'front', expr: 'front lip' }]);
    expect(variableDiagnostics(renamed)).toEqual([]);
    const gone = deleteVariable(renamed, id);
    expect(gone.runRequests![0].bindings).toBeUndefined();
    expect(gone.runRequests![0].front).toBe(30);
  });

  it('with refresh off, the asked part is made again when its binding changes it', () => {
    const { p, id } = setup();
    const bound = applyBindings(p);
    // Made with the bound 30 mm overhang, then refresh turned off.
    const off: Project = {
      ...bound,
      runParts: planRuns(bound).parts,
      runSettings: { scribe: 0, auto: false },
    };
    const before = off.runParts!.find((r) => r.kind === 'worktop')!.box.d;
    // Nothing changed: the same project.
    expect(remakeAskedParts(off, applyBindings(off))).toBe(off);
    const changed = updateVariable(off, id, { expr: '50' });
    const after = remakeAskedParts(changed, applyBindings(changed));
    expect(after.runParts!.find((r) => r.kind === 'worktop')!.box.d).toBe(before + 20);
  });

  it('store: binding a request is one undo step and the worktop follows the variable', () => {
    const p0 = row('base-door', 2);
    st().openProject({ ...p0, items: [], schemaVersion: 1 });
    for (const it of p0.items) st().addPiece(it.design);
    const ids = st().project!.items.map((i) => i.id);
    const vid = st().addVariable('lip', '40');
    const req: RunRequest = { kind: 'worktop', from: ids };
    st().setRunRequest(req);
    const d20 = st().project!.runParts!.find((r) => r.kind === 'worktop')!.box.d;
    st().bindRequest(req, 'front', 'lip');
    const top = () => st().project!.runParts!.find((r) => r.kind === 'worktop')!;
    expect(st().project!.runRequests![0].bindings).toEqual([{ target: 'front', expr: 'lip' }]);
    expect(top().box.d).toBe(d20 + 20);
    st().updateVariable(vid, { expr: '25' });
    expect(top().box.d).toBe(d20 + 5);
    st().undoProject();
    expect(top().box.d).toBe(d20 + 20);
    st().undoProject();
    expect(st().project!.runRequests![0].bindings).toBeUndefined();
    expect(top().box.d).toBe(d20);
  });

  it('documents: bindings only on the targets a request has', () => {
    const { p } = setup();
    expect(validateProject(p)).toEqual([]);
    expect(
      validateProject({
        ...p,
        runRequests: [{ ...p.runRequests![0], bindings: [{ target: 'width', expr: '1' }] }],
      }),
    ).toContain('Invalid run request');
  });
});

describe('formula comparisons, if and round(x, step) (ADR-209 item 7)', () => {
  const scope = new Map([
    ['w', 600],
    ['zero', 0],
  ]);
  const v = (e: string) => evaluateExpr(e, scope);

  it('comparisons are 1 or 0, in every spelling', () => {
    expect(v('w < 700')).toEqual({ raw: 1 });
    expect(v('w < 600')).toEqual({ raw: 0 });
    expect(v('w <= 600')).toEqual({ raw: 1 });
    expect(v('w ≤ 599')).toEqual({ raw: 0 });
    expect(v('w > 599')).toEqual({ raw: 1 });
    expect(v('w >= 601')).toEqual({ raw: 0 });
    expect(v('w ≥ 600')).toEqual({ raw: 1 });
    expect(v('w = 600')).toEqual({ raw: 1 });
    expect(v('w <> 600')).toEqual({ raw: 0 });
    expect(v('w ≠ 500')).toEqual({ raw: 1 });
    // Sums bind tighter than a comparison.
    expect(v('w + 100 > 650')).toEqual({ raw: 1 });
    expect(v('(w > 500) * 18')).toEqual({ raw: 18 });
  });

  it('if(c, a, b): a when c is not 0; a division by zero in the branch not taken is ignored', () => {
    expect(v('if(w > 500, 18, 16)')).toEqual({ raw: 18 });
    expect(v('if(w > 700, 18, 16)')).toEqual({ raw: 16 });
    expect(v('if(zero, 1 / zero, 5)')).toEqual({ raw: 5 });
    expect(v('if(1, 1 / zero, 5)')).toMatchObject({ problem: /Division by zero/ });
    expect(v('if(1, 2)')).toHaveProperty('problem');
    expect(v('if(1, 2, 3, 4)')).toHaveProperty('problem');
    // A formula that does not parse is a problem in either branch.
    expect(v('if(0, (1, 5)')).toHaveProperty('problem');
  });

  it('round(x, step) is the nearest multiple of step; a step of 0 or less, or a wrong count, is a problem', () => {
    expect(v('round(w / 7, 10)')).toEqual({ raw: 90 });
    expect(v('round(587, 32)')).toEqual({ raw: 576 });
    expect(v('round(2.5)')).toEqual({ raw: 3 });
    expect(v('round(587, 0)')).toMatchObject({ problem: /step of “round” must be more than 0/ });
    expect(v('round(587, -5)')).toMatchObject({ problem: /step of “round” must be more than 0/ });
    expect(v('round(1, 2, 3)')).toHaveProperty('problem');
    expect(v('round()')).toHaveProperty('problem');
    // In the branch not taken, a zero step is ignored too.
    expect(v('if(0, round(5, 0), 7)')).toEqual({ raw: 7 });
  });

  it('a step of 0 in a binding is an error diagnostic, never a throw; `if` is a reserved name', () => {
    const p0 = row('base-door', 2);
    let p = addVariable(p0, 'step', '0').project;
    p = planned(p, [
      {
        kind: 'worktop',
        from: p0.items.map((i) => i.id),
        bindings: [{ target: 'front', expr: 'round(33, step)' }],
      },
    ]);
    expect(() => applyBindings(p)).not.toThrow();
    expect(variableDiagnostics(applyBindings(p)).map((d) => d.code)).toEqual(['binding-problem']);
    expect(nameProblem('if')).toMatch(/name of a formula function/);
    expect(nameProblem('IF')).toMatch(/name of a formula function/);
  });
});

// ---------------------------------------------------------------------------
// 8. Repair fillers kept by automatic refresh
// ---------------------------------------------------------------------------

describe('the filler repair is a run request kept by automatic refresh (ADR-209 item 8)', () => {
  /**
   * A bookcase with a wardrobe turned to face it, 200 mm in front (as the ADR-071 tests do with a chest); automatic
   * refresh on. Neither is a base unit, so refresh adds no worktop in the doors' way.
   */
  function facing(): Project {
    let p = newProject('Facing');
    p = { ...p, items: [makeItem(p, tpl('bookcase'))] };
    const chest = placeItem(p.items[0]).bounds;
    const it = makeItem(p, tpl('wardrobe'));
    const q: Project = {
      ...p,
      items: [
        ...p.items,
        { ...it, rotationY: 180, position: { x: 0, y: 0, z: chest.z + chest.d + 200 } },
      ],
      runSettings: { scribe: 0, auto: true },
    };
    return refreshRunParts(q);
  }
  const fillerRepair = (p: Project) => {
    const pm = buildProjectModel(p);
    const [chest, wardrobe] = p.items;
    for (const d of pm.diagnostics.filter(
      (x) => x.code === 'opening-blocked' && x.nodeId === wardrobe.id,
    )) {
      const r = repairsFor(p, pm, d).find(
        (x) => !x.refused && / and add a \d+ mm filler$/.test(x.label),
      );
      if (r) return { d, r, chest, wardrobe };
    }
    return null;
  };

  it('with automatic refresh on the filler repair is offered and adds a request of kind filler and its part', () => {
    const p = facing();
    const found = fillerRepair(p);
    expect(found).not.toBeNull();
    const { r, chest, wardrobe } = found!;
    const w = Number(/add a (\d+) mm filler$/.exec(r.label)![1]);
    const key = `filler|${wardrobe.id},${chest.id}`;
    expect(r.project.runRequests).toEqual([
      { kind: 'filler', from: [wardrobe.id, chest.id], width: w },
    ]);
    const part = r.project.runParts!.find((x) => x.key === key)!;
    expect(part.kind).toBe('filler');
    // In the wardrobe's front plane (it faces −z: its front is its back-most z), as high as it, of its front board.
    const wb = placeItem(r.project.items.find((i) => i.id === wardrobe.id)!).bounds;
    expect(part.box).toMatchObject({ y: wb.y, z: wb.z, h: wb.h, w });
    expect(part.box.x === wb.x + wb.w || part.box.x + w === wb.x).toBe(true);
    expect(r.preview.some((x) => x.id === `run:${part.id}`)).toBe(true);
    // A refresh keeps it exactly.
    const again = refreshRunParts(r.project);
    expect(again.runParts!.find((x) => x.key === key)!.box).toEqual(part.box);
    expect(validateProject(r.project)).toEqual([]);
  });

  it('applies in one undo step and the filler follows a move of its pieces', () => {
    const p = facing();
    st().openProject(p);
    const { r, chest, wardrobe } = fillerRepair(st().project!)!;
    const key = `filler|${wardrobe.id},${chest.id}`;
    st().updateProject(() => r.project);
    const filler = () => st().project!.runParts?.find((x) => x.key === key);
    expect(filler()).toBeDefined();
    const box0 = filler()!.box;
    // The whole repair (move + request + part) undoes in one step.
    st().undoProject();
    expect(st().project!.runRequests ?? []).toEqual([]);
    expect(filler()).toBeUndefined();
    st().redoProject();
    expect(filler()!.box).toEqual(box0);
    // Moving both pieces 100 mm to the right: refresh moves the filler with them.
    st().moveItemBy(chest.id, 100, 0, 1, { alone: true });
    st().moveItemBy(wardrobe.id, 100, 0, 1, { alone: true });
    expect(filler()!.box).toEqual({ ...box0, x: box0.x + 100 });
    // Removing the filler removes its request.
    st().removeRunPart(filler()!.id);
    expect(st().project!.runRequests ?? []).toEqual([]);
    st().suggestRunParts();
    expect(filler()).toBeUndefined();
  });

  it('a filler request whose piece is gone is not made', () => {
    const p = facing();
    const { r, wardrobe } = fillerRepair(p)!;
    const without = settle({
      ...r.project,
      items: r.project.items.filter((i) => i.id !== wardrobe.id),
    });
    expect(without.runParts?.some((x) => x.kind === 'filler') ?? false).toBe(false);
  });

  it('documents: a filler request has two pieces and a whole-mm width', () => {
    const { r } = fillerRepair(facing())!;
    const req = r.project.runRequests![0];
    expect(validateProject({ ...r.project, runRequests: [{ ...req, width: 0 }] })).toContain(
      'Invalid run request',
    );
    expect(
      validateProject({ ...r.project, runRequests: [{ ...req, from: [req.from[0]] }] }),
    ).toContain('Invalid run request');
    expect(
      validateProject({
        ...r.project,
        runRequests: [{ kind: 'worktop', from: req.from, width: 10 }],
      }),
    ).toContain('Invalid run request');
  });
});

// ---------------------------------------------------------------------------
// 9. Fasteners: the edge distance and drilling positions
// ---------------------------------------------------------------------------

describe('fastener edge distance and drilling positions (ADR-209 item 9)', () => {
  const carcass = (per: number, edge?: number): FastenerChoice => ({
    joint: 'carcass-joint',
    name: 'My fixing',
    per,
    ...(edge !== undefined ? { edge } : {}),
  });

  it('fixingSpots: one centred, else from edge to length − edge in exact whole-mm steps', () => {
    expect(fixingSpots(560, 1, 50)).toEqual([280]);
    expect(fixingSpots(561, 1, 50)).toEqual([281]);
    expect(fixingSpots(560, 2, 50)).toEqual([50, 510]);
    expect(fixingSpots(560, 3, 50)).toEqual([50, 280, 510]);
    // 461 mm in 3 gaps: 154 + 154 + 153, the spare millimetres first.
    expect(fixingSpots(561, 4, 50)).toEqual([50, 204, 358, 511]);
    expect(fixingSpots(101, 2, 50)).toEqual([50, 51]);
    // Too short for `per` separate fixings at `edge` from each end.
    expect(fixingSpots(100, 2, 50)).toBeNull();
    expect(fixingSpots(99, 2, 50)).toBeNull();
    expect(fixingSpots(101, 3, 50)).toBeNull();
  });

  it('no positions without a carcass-joint choice with edge typed', () => {
    const model = buildModel(tpl('chest'));
    expect(fixingPositions(model, undefined).parts.size).toBe(0);
    expect(fixingPositions(model, carcass(2)).parts.size).toBe(0);
    expect(
      fixingPositions(model, { joint: 'shelf-pin', name: 'pin', per: 4, edge: 50 }).parts.size,
    ).toBe(0);
  });

  it('with edge typed, each carcass joint gets `per` positions at exact places on the drilled board', () => {
    const d = tpl('chest');
    const model = buildModel(d);
    const { parts, tooShort } = fixingPositions(model, carcass(2, 50));
    expect(tooShort).toBe(0);
    expect(parts.size).toBeGreaterThan(0);
    for (const [id, part] of parts) {
      const panel = model.panels.find((x) => x.id === id)!;
      expect(panel).toBeDefined();
      // On the part's face; whole mm; an even count (two per joint).
      expect(part.at.length % 2).toBe(0);
      for (const [u, v] of part.at) {
        expect(Number.isInteger(u) && Number.isInteger(v)).toBe(true);
        expect(u >= 0 && u <= part.u && v >= 0 && v <= part.v).toBe(true);
      }
    }
    // The chest: its bottom sits between the sides (drilled through each side), its top on the sides (drilled through
    // the top). Positions worked out by hand from the boxes: along each contact line `edge` from each end, across it at
    // the other board's mid-thickness; [u, v] on the drilled face's in-plane axes (side: y, z; top: x, z).
    const byRole = (role: string) => model.panels.filter((x) => x.role === role);
    const [bottom] = byRole('bottom');
    const [top] = byRole('top');
    const sides = byRole('side');
    expect(parts.has(bottom.id)).toBe(false);
    for (const side of sides) {
      const z0 = Math.max(side.box.z, bottom.box.z),
        z1 = Math.min(side.box.z + side.box.d, bottom.box.z + bottom.box.d);
      const midY = bottom.box.y + Math.floor(bottom.box.h / 2) - side.box.y;
      expect(parts.get(side.id)).toEqual({
        u: side.box.h,
        v: side.box.d,
        at: [
          [midY, z0 + 50 - side.box.z],
          [midY, z1 - 50 - side.box.z],
        ],
      });
    }
    const tp = parts.get(top.id)!;
    expect([tp.u, tp.v]).toEqual([top.box.w, top.box.d]);
    const expected = sides.flatMap((side) => {
      const midX = side.box.x + Math.floor(side.box.w / 2) - top.box.x;
      const z0 = Math.max(side.box.z, top.box.z),
        z1 = Math.min(side.box.z + side.box.d, top.box.z + top.box.d);
      return [
        [midX, z0 + 50 - top.box.z],
        [midX, z1 - 50 - top.box.z],
      ];
    });
    expect([...tp.at].sort()).toEqual([...expected].sort());
    // Three per joint: centred between, in exact whole-mm steps.
    const three = fixingPositions(model, carcass(3, 50)).parts.get(sides[0].id)!;
    const s0 = sides[0];
    const lo = Math.max(s0.box.z, bottom.box.z),
      hi = Math.min(s0.box.z + s0.box.d, bottom.box.z + bottom.box.d);
    expect(three.at.map(([, v]) => v)).toEqual(
      fixingSpots(hi - lo, 3, 50)!.map((s) => lo + s - s0.box.z),
    );
    const sp = parts.get(sides[0].id)!;
    // The note says guidance; no diameter, depth or screw.
    const note = fixingNote(sp);
    expect(note).toMatch(/^fixing holes at \d+\/\d+(, \d+\/\d+)* mm, guidance from your values$/);
    expect(note).not.toMatch(/Ø|diameter|depth|screw|deep/i);
    expect(drillingRo(note)).toMatch(/^găuri de fixare la .* mm, orientativ, din valorile tale$/);
    setPrintLang('ru');
    expect(drillingRo(note)).toMatch(/по вашим значениям$/);
    setPrintLang('en');
    expect(drillingRo(note)).toMatch(/guidance from your values$/);
  });

  it('joints shorter than twice the edge distance get none and are counted', () => {
    const model = buildModel(tpl('chest'));
    const huge = fixingPositions(model, carcass(2, 2000));
    expect(huge.parts.size).toBe(0);
    expect(huge.tooShort).toBeGreaterThan(0);
    // One per joint is always centred.
    const one = fixingPositions(model, carcass(1, 2000));
    expect(one.tooShort).toBe(0);
    expect(one.parts.size).toBeGreaterThan(0);
  });

  it('the choice validates edge as whole mm 0–5000 and is saved in the existing prices row', async () => {
    expect(validFastenerChoice(carcass(2, 50))).toBe(true);
    expect(validFastenerChoice(carcass(2))).toBe(true);
    expect(validFastenerChoice({ ...carcass(2), edge: -1 })).toBe(false);
    expect(validFastenerChoice({ ...carcass(2), edge: 5001 })).toBe(false);
    expect(validFastenerChoice({ ...carcass(2), edge: 2.5 })).toBe(false);
    const version = db.verno;
    await saveFastener(carcass(2, 37));
    expect((await listFasteners()).find((c) => c.joint === 'carcass-joint')).toEqual(
      carcass(2, 37),
    );
    const row = await db.prices.get('fastener:carcass-joint');
    expect(row).toMatchObject({ text: 'My fixing', per: 2, edge: 37 });
    // Without the edge: none stored.
    await saveFastener(carcass(3));
    expect((await listFasteners()).find((c) => c.joint === 'carcass-joint')).toEqual(carcass(3));
    expect(db.verno).toBe(version);
    await deleteFastener('carcass-joint');
  });
});

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

describe('documents (ADR-209)', () => {
  beforeEach(() => setPrintLang('ro'));

  it('a project at the shared version 21 with every new field validates; older versions refuse the new fields', () => {
    expect(PROJECT_SCHEMA).toBe(21);
    const { p, wt } = kitchen();
    const [a, b] = p.items.map((i) => i.id);
    const full: Project = {
      ...p,
      schemaVersion: 21,
      runRequests: [
        { kind: 'worktop', from: [a, b], bindings: [{ target: 'front', expr: '20' }] },
        { kind: 'filler', from: [a, b], width: 30 },
      ],
      sinks: [{ id: 's1', baseId: b, w: 500, d: 400, x: 40, z: 60 }],
      worktopEdges: [{ key: runPartKey(wt), kind: 'rounded', size: 6 }],
    };
    expect(validateProject(full)).toEqual([]);
    const old = { ...full, schemaVersion: 20 } as unknown as Project;
    const errs = validateProject(old);
    expect(errs).toContain(
      'Moulding profiles, bindings and repair fillers need project schemaVersion 21',
    );
    expect(errs).toContain('Worktop edges need project schemaVersion 21');
  });

  it('older project files without the new fields load unchanged', () => {
    const p0 = row('base-door', 2);
    for (const v of [1, 13, 20, 21]) {
      const doc = { ...p0, schemaVersion: v } as unknown as Project;
      expect(validateProject(doc)).toEqual([]);
      const pm = buildProjectModel(doc);
      expect(pm.pieces).toHaveLength(2);
    }
    // A version-13 sink without offsets is centred as before.
    const { p } = kitchen();
    const v13 = {
      ...p,
      schemaVersion: 13,
      sinks: [{ id: 's1', baseId: p.items[1].id, w: 500, d: 400 }],
    } as unknown as Project;
    expect(validateProject(v13)).toEqual([]);
    expect(
      validateProject({ ...v13, sinks: [{ ...v13.sinks![0], x: 10 }] } as unknown as Project),
    ).toContain('Cut-out positions need project schemaVersion 21');
  });

  it('template version 3 files without run requests load; run requests need version 3', () => {
    const plain = templateFromProject(row('base-door', 2), 'Plain');
    expect(validateProjectTemplate(plain)).toEqual([]);
    const v3 = { ...plain, schemaVersion: 3 as const };
    expect(validateProjectTemplate(v3)).toEqual([]);
    expect(projectFromTemplate(v3).items).toHaveLength(2);
    const p = row('wall-cabinet', 2);
    const ids = p.items.map((i) => i.id);
    const tp = templateFromProject(
      planned(p, [{ kind: 'crown', from: ids, height: 60, material: board(p) }]),
      'Run',
    );
    expect(validateProjectTemplate({ ...tp, schemaVersion: 1 })).toContain(
      'Run requests need template schemaVersion 3',
    );
  });

  it('a request key stays kind|ids for every new kind', () => {
    expect(requestKey({ kind: 'filler', from: ['a', 'b'] })).toBe('filler|a,b');
  });
});

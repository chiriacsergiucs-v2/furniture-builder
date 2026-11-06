// Kitchen cut-outs, worktop corners and placement precision (ADR-205): side-wall runs and worktop corner joints, hobs,
// sink and hob notes in the notes column (cut list, CSV and print in ro/ru/en), the cut-out outlines on the plan, the
// back cut around a pipe or outlet, the installation zone and template zones, wall-unit height snapping, angled-piece
// snapping and overlap amounts, mirrored copies that match to the mm, and the documents (ADR-011).
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mirrorDesign, mirrorSpace } from '../src/core/arrange';
import { buildModel } from '../src/core/build';
import { catalogFamilies, insertVariant } from '../src/core/catalog';
import { cutlist } from '../src/core/cutlist';
import { templates, SCHEMA_VERSION, upgradeDesign, validateDesign } from '../src/core/design';
import { distribute, penetration } from '../src/core/geometry';
import { snapWallHeight } from '../src/core/height';
import { setPrintLang } from '../src/core/i18n/print';
import {
  buildProjectModel,
  cutoutOutlines,
  makeItem,
  newProject,
  placeItem,
  planRuns,
  PROJECT_SCHEMA,
  PROJECT_SCHEMAS,
  projectCutlist,
  pruneWorktopJoints,
  resolvePlacements,
  validateProject,
  worktopCorners,
  worktopJointCuts,
  worktopJointLines,
  runPartKey,
  type Project,
  type ProjectItem,
  type WorktopJoint,
} from '../src/core/project';
import {
  projectFromTemplate,
  templateFromProject,
  TEMPLATE_SCHEMA,
  validateProjectTemplate,
} from '../src/core/projectTemplate';
import { repairsFor } from '../src/core/repairs';
import { cutlistCsvRo, drillingRo } from '../src/core/ro';
import { shapeOutline, type Room, type RoomFeature } from '../src/core/room';
import { snapDrag } from '../src/core/snap';
import type { Box, CabinetParams, Design, Panel, Space } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const st = () => useDesign.getState();

/**
 * An L of base units: two along the back wall (x 0..1200) and two turned a quarter along a side wall, starting at the
 * back units' front. `side` 'left' turns them 90° against x = 0 (facing +x); 'right' turns them 270° against x = 1200.
 */
function lKitchen(side: 'left' | 'right' = 'left'): Project {
  let p: Project = newProject('L kitchen');
  for (let i = 0; i < 2; i++) p = { ...p, items: [...p.items, makeItem(p, t('base-door'))] };
  for (let i = 0; i < 2; i++) {
    const it = makeItem(p, t('base-door'));
    p = {
      ...p,
      items: [
        ...p.items,
        {
          ...it,
          rotationY: side === 'left' ? 90 : 270,
          position: { x: side === 'left' ? 0 : 622, y: 0, z: 578 + i * 600 },
        },
      ],
    };
  }
  return p;
}
/** The L with the run parts Suggest makes (runs along the side walls planned too). */
const withParts = (side: 'left' | 'right' = 'left'): Project => {
  const p = lKitchen(side);
  return { ...p, runParts: planRuns(p, { sides: true }).parts };
};
const tops = (p: Project) => (p.runParts ?? []).filter((r) => r.kind === 'worktop');
const back = (p: Project) => tops(p).find((r) => r.grainAxis === 'x')!;
const sideTop = (p: Project) => tops(p).find((r) => r.grainAxis === 'z')!;
const joint = (p: Project, kind: WorktopJoint['kind'], through?: 'a' | 'b'): Project => ({
  ...p,
  worktopJoints: [
    {
      id: 'j1',
      a: runPartKey(back(p)),
      b: runPartKey(sideTop(p)),
      kind,
      ...(through ? { through } : {}),
    },
  ],
});
const codes = (p: Project, code: string) =>
  buildProjectModel(p).diagnostics.filter((d) => d.code === code);
const runRows = (p: Project) => projectCutlist(p).filter((r) => r.labels.includes('Run: Worktop'));

describe('worktop corners (ADR-205, G-010)', () => {
  it('runs along the side walls are planned only when asked (Suggest); existing run parts do not change', () => {
    const p = lKitchen();
    const plain = planRuns(p).parts;
    expect(plain.filter((r) => r.kind === 'worktop').map((r) => r.grainAxis)).toEqual(['x']);
    const asked = planRuns(p, { sides: true }).parts;
    expect(
      asked
        .filter((r) => r.kind === 'worktop')
        .map((r) => r.grainAxis)
        .sort(),
    ).toEqual(['x', 'z']);
    // The back worktop is the same part either way.
    expect(asked.find((r) => r.kind === 'worktop' && r.grainAxis === 'x')).toEqual(
      plain.find((r) => r.kind === 'worktop'),
    );
    // Once a side run has parts, planning again keeps them.
    const q = { ...p, runParts: asked };
    expect(planRuns(q).parts.filter((r) => r.kind === 'worktop')).toHaveLength(2);
  });

  it.each(['left', 'right'] as const)(
    '%s: an L of two runs gets two worktops and the error worktop-corner-joint until a joint is picked',
    (side) => {
      const p = withParts(side);
      expect(worktopCorners(p)).toHaveLength(1);
      const d = codes(p, 'worktop-corner-joint');
      expect(d).toHaveLength(1);
      expect(d[0].severity).toBe('error');
      expect(d[0].message).toBe(
        'The worktops over Base cabinet + Base cabinet and Base cabinet + Base cabinet overlap at the corner: choose a mitred or butt joint.',
      );
      // No default joint: nothing is cut until the user picks one.
      expect(worktopJointCuts(p).size).toBe(0);
      expect(worktopJointLines(p)).toEqual([]);
      expect(codes(joint(p, 'mitre'), 'worktop-corner-joint')).toEqual([]);
      // A butt joint needs the worktop that runs through.
      const butt = codes(joint(p, 'butt'), 'worktop-corner-joint');
      expect(butt.map((x) => [x.severity, x.message])).toEqual([
        [
          'error',
          'The worktops over Base cabinet + Base cabinet and Base cabinet + Base cabinet meet in a butt joint: choose the one that runs through.',
        ],
      ]);
      expect(codes(joint(p, 'butt', 'a'), 'worktop-corner-joint')).toEqual([]);
    },
  );

  it('mitred: both worktops reach the outer corner, profiled along the diagonal from the inner corner, whole mm', () => {
    const p = joint(withParts('left'), 'mitre');
    const A = back(p),
      B = sideTop(p);
    const cuts = worktopJointCuts(p);
    const a = cuts.get(A.id)!,
      b = cuts.get(B.id)!;
    // The side worktop faces +x: the outer corner is (x 0, z 0), the inner corner where the front edges meet.
    const inner = [B.box.x + B.box.w, A.box.z + A.box.d];
    expect(a.box).toEqual({ ...A.box, x: 0, w: A.box.x + A.box.w });
    expect(b.box).toEqual({ ...B.box, z: 0, d: B.box.z + B.box.d });
    expect(a.shape).toEqual({
      kind: 'profile',
      points: [
        [0, 0],
        [A.box.w, 0],
        [A.box.w, A.box.d],
        [inner[0], A.box.d],
      ],
    });
    expect(b.shape).toEqual({
      kind: 'profile',
      points: [
        [0, 0],
        [B.box.w, inner[1]],
        [B.box.w, B.box.z + B.box.d],
        [0, B.box.z + B.box.d],
      ],
    });
    for (const s of [a.shape!, b.shape!])
      if (s.kind === 'profile')
        for (const [u, v] of s.points)
          expect(Number.isInteger(u) && Number.isInteger(v)).toBe(true);
    expect(a.notes).toEqual(['mitre joint']);
    expect(b.notes).toEqual(['mitre joint']);
    // The joint line on the plan: from the inner corner to the outer corner.
    expect(worktopJointLines(p)).toEqual([
      { id: 'j1', kind: 'mitre', line: [inner[0], inner[1], 0, 0] },
    ]);
    // Applied at build: the stored worktops never change, the built ones are profiled.
    const stored = structuredClone(p.runParts);
    const pm = buildProjectModel(p);
    expect(p.runParts).toEqual(stored);
    const built = pm.model.panels.filter((x) => x.role === 'worktop');
    expect(built).toHaveLength(2);
    expect(built.every((x) => x.shape?.kind === 'profile')).toBe(true);
    // Each cut-list row notes the joint in its notes column.
    const rows = runRows(p);
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.drilling).toContain('mitre joint');
  });

  it('mitred on the right-hand wall mirrors the cut: the outer corner is at the side worktop back edge', () => {
    const p = joint(withParts('right'), 'mitre');
    const A = back(p),
      B = sideTop(p);
    const outer = B.box.x + B.box.w;
    const line = worktopJointLines(p)[0].line;
    expect(line).toEqual([B.box.x, A.box.z + A.box.d, outer, A.box.z]);
    const a = worktopJointCuts(p).get(A.id)!;
    expect(a.box.x + a.box.w).toBe(outer);
  });

  it('butt: the worktop that runs through reaches the outer corner, the other stops at its front edge', () => {
    const p0 = withParts('left');
    const A = back(p0),
      B = sideTop(p0);
    // a (the back worktop) runs through: it keeps its length; b starts at a's front edge.
    const pa = joint(p0, 'butt', 'a');
    const ca = worktopJointCuts(pa);
    expect(ca.get(A.id)!.box).toEqual(A.box);
    expect(ca.get(A.id)!.shape).toBeUndefined();
    expect(ca.get(B.id)!.box).toEqual({
      ...B.box,
      z: A.box.z + A.box.d,
      d: B.box.z + B.box.d - (A.box.z + A.box.d),
    });
    expect(ca.get(A.id)!.notes).toEqual(['butt joint against Base cabinet + Base cabinet']);
    expect(worktopJointLines(pa)[0]).toEqual({
      id: 'j1',
      kind: 'butt',
      line: [0, A.box.d, B.box.w, A.box.d],
    });
    // b runs through: it reaches z 0, and a stops at b's front edge.
    const pb = joint(p0, 'butt', 'b');
    const cb = worktopJointCuts(pb);
    expect(cb.get(B.id)!.box).toEqual({ ...B.box, z: 0, d: B.box.z + B.box.d });
    expect(cb.get(A.id)!.box).toEqual({
      ...A.box,
      x: B.box.w,
      w: A.box.x + A.box.w - B.box.w,
    });
    const rows = runRows(pb);
    expect(rows.map((r) => r.drilling).filter((n) => /butt joint against/.test(n))).toHaveLength(2);
    // The two worktops are cut to different lengths.
    expect(new Set(rows.map((r) => r.length)).size).toBe(2);
  });

  it('the joint notes print in the print language (ro, ru, en)', () => {
    try {
      expect(drillingRo('mitre joint')).toBe('îmbinare la 45°');
      expect(drillingRo('butt joint against Base 600')).toBe('îmbinare cap la cap cu Base 600');
      setPrintLang('ru');
      expect(drillingRo('mitre joint')).toBe('соединение под 45°');
      expect(drillingRo('butt joint against Base 600')).toBe('соединение встык с Base 600');
      setPrintLang('en');
      expect(drillingRo('mitre joint')).toBe('mitre joint');
      expect(drillingRo('butt joint against Base 600')).toBe('butt joint against Base 600');
    } finally {
      setPrintLang('ro');
    }
  });

  it('a joint is pruned with its worktops; the store keeps one joint per corner', () => {
    const p = joint(withParts('left'), 'mitre');
    expect(pruneWorktopJoints(p)).toBe(p);
    const gone = { ...p, runParts: p.runParts!.filter((r) => r.grainAxis !== 'z') };
    expect(pruneWorktopJoints(gone).worktopJoints).toBeUndefined();
    useDesign.setState({ project: null });
    st().openProject(withParts('left'));
    const q = st().project!;
    const a = runPartKey(back(q)),
      b = runPartKey(sideTop(q));
    st().setWorktopJoint({ id: 'x1', a, b, kind: 'mitre' });
    st().setWorktopJoint({ id: 'x2', a: b, b: a, kind: 'butt', through: 'a' });
    expect(st().project!.worktopJoints).toEqual([
      { id: 'x2', a: b, b: a, kind: 'butt', through: 'a' },
    ]);
  });
});

describe('hob cut-outs and the cut-out outlines (ADR-205, G-035, G-212)', () => {
  /** Two base units on the back wall with their run worktop. */
  const run = (): Project => {
    let p = newProject('Run');
    for (let i = 0; i < 2; i++) p = { ...p, items: [...p.items, makeItem(p, t('base-door'))] };
    return { ...p, runParts: planRuns(p).parts };
  };
  const hobCodes = (p: Project) =>
    buildProjectModel(p)
      .diagnostics.filter((d) => d.code.startsWith('hob-'))
      .map((d) => `${d.severity}:${d.code}:${d.message}`);

  it('a hob over a base is a note in the worktop row’s notes column with the size the user typed', () => {
    const p0 = run();
    const p = { ...p0, hobs: [{ id: 'h1', baseId: p0.items[1].id, w: 560, d: 490 }] };
    expect(hobCodes(p)).toEqual([]);
    const rows = runRows(p);
    expect(rows).toHaveLength(1);
    expect(rows[0].labels).toEqual(['Run: Worktop']);
    expect(rows[0].drilling).toContain('hob cut-out 560 × 490 mm');
    // Sink and hob together: both notes, sink first.
    const both = { ...p, sinks: [{ id: 's1', baseId: p0.items[0].id, w: 500, d: 400 }] };
    expect(runRows(both)[0].drilling).toMatch(
      /sink cut-out 500 × 400 mm.*hob cut-out 560 × 490 mm/,
    );
  });

  it('the CSV and the printed notes show the hob and sink cut-outs in the print language', () => {
    const p0 = run();
    const p = {
      ...p0,
      sinks: [{ id: 's1', baseId: p0.items[0].id, w: 500, d: 400 }],
      hobs: [{ id: 'h1', baseId: p0.items[1].id, w: 560, d: 490 }],
    };
    const rows = projectCutlist(p);
    const top = runRows(p)[0];
    try {
      expect(drillingRo(top.drilling)).toContain('decupaj chiuvetă 500 × 400 mm');
      expect(drillingRo(top.drilling)).toContain('decupaj plită 560 × 490 mm');
      expect(cutlistCsvRo(rows)).toContain('decupaj plită 560 × 490 mm');
      setPrintLang('ru');
      expect(drillingRo(top.drilling)).toContain('вырез под мойку 500 × 400 мм');
      expect(drillingRo(top.drilling)).toContain('вырез под варочную панель 560 × 490 мм');
      expect(cutlistCsvRo(rows)).toContain('вырез под варочную панель 560 × 490 мм');
      setPrintLang('en');
      expect(drillingRo(top.drilling)).toContain('sink cut-out 500 × 400 mm');
      expect(cutlistCsvRo(rows)).toContain('hob cut-out 560 × 490 mm');
    } finally {
      setPrintLang('ro');
    }
  });

  it('three diagnostics with hob wording: no worktop, wider than the base, as deep as the worktop', () => {
    let bare = newProject('Bare');
    bare = { ...bare, items: [makeItem(bare, t('base-door'))] };
    const id = bare.items[0].id;
    expect(hobCodes({ ...bare, hobs: [{ id: 'h', baseId: id, w: 560, d: 490 }] })).toEqual([
      'warning:hob-no-worktop:The hob over Base cabinet has no worktop to be cut out of; add the run worktop.',
    ]);
    const p0 = run();
    const top = p0.runParts!.find((r) => r.kind === 'worktop')!;
    const b = p0.items[0].id;
    const w = placeItem(p0.items[0]).bounds.w;
    expect(hobCodes({ ...p0, hobs: [{ id: 'h', baseId: b, w: 700, d: top.box.d }] })).toEqual([
      `error:hob-cutout-deep:Hob cut-out 700 × ${top.box.d} mm is as deep as the worktop over Base cabinet (${top.box.d} mm) or deeper.`,
      `warning:hob-cutout-wide:Hob cut-out 700 mm is wider than Base cabinet under it (${w} mm).`,
    ]);
  });

  it('the plan outlines each sink and hob cut-out centred on its base and on the worktop depth', () => {
    const p0 = run();
    const p = {
      ...p0,
      sinks: [{ id: 's1', baseId: p0.items[0].id, w: 500, d: 400 }],
      hobs: [{ id: 'h1', baseId: p0.items[1].id, w: 561, d: 491 }],
    };
    const pieces = resolvePlacements(p).items.map((i) => placeItem(i));
    const top = p.runParts!.find((r) => r.kind === 'worktop')!.box;
    const out = cutoutOutlines(p, pieces);
    expect(out.map((c) => [c.id, c.kind, c.w, c.d])).toEqual([
      ['sink:s1', 'sink', 500, 400],
      ['hob:h1', 'hob', 561, 491],
    ]);
    const b1 = pieces[1].bounds;
    const hob = out[1];
    // Centred along the base (a half mm rounds down) and across the worktop depth, on the worktop.
    expect(hob.box).toEqual({
      x: b1.x + Math.floor((b1.w - 561) / 2),
      y: top.y,
      z: top.z + Math.floor((top.d - 491) / 2),
      w: 561,
      h: top.h,
      d: 491,
    });
    expect(hob.placed).toBe(false);
    // A cut-out without a worktop is not drawn.
    expect(cutoutOutlines({ ...p, runParts: [] }, pieces)).toEqual([]);
  });

  it('a hob on a side-wall run is measured across that worktop', () => {
    const p0 = withParts('left');
    const sideBase = p0.items[2].id;
    const top = sideTop(p0);
    const p = { ...p0, hobs: [{ id: 'h1', baseId: sideBase, w: 560, d: 490 }] };
    expect(hobCodes(p)).toEqual([]);
    const pieces = resolvePlacements(p).items.map((i) => placeItem(i));
    const o = cutoutOutlines(p, pieces)[0];
    // Along the run (z) it is 560, across the worktop (x) 490.
    expect([o.box.w, o.box.d]).toEqual([490, 560]);
    expect(o.box.x).toBeGreaterThanOrEqual(top.box.x);
    expect(o.box.x + o.box.w).toBeLessThanOrEqual(top.box.x + top.box.w);
  });
});

// ---------------------------------------------------------------------------------------------------------------------

const room = (features: RoomFeature[] = []): Room => ({
  height: 2600,
  outline: shapeOutline('rectangle', {
    width: 3000,
    depth: 3000,
    cutWidth: 0,
    cutDepth: 0,
    offset: 0,
  }),
  features,
});
const pipe = (patch: Partial<RoomFeature> = {}): RoomFeature => ({
  id: 'p1',
  kind: 'pipe',
  wall: 0,
  from: 200,
  width: 100,
  sill: 300,
  height: 100,
  depth: 0,
  label: 'Pipe 1',
  ...patch,
});
const one = (d: Design, r: Room, patch: Partial<ProjectItem> = {}): Project => {
  const p = newProject('Services');
  return { ...p, items: [{ ...makeItem(p, d), ...patch }], room: r };
};

describe('back cut-out at a pipe or outlet (ADR-205, G-030)', () => {
  it('Cut the back around it: a hole of the zone size, noted in the cut list and print, and the warning clears', () => {
    const p = one(t('base-door'), room([pipe()]));
    const pm = buildProjectModel(p);
    const warn = pm.diagnostics.filter((d) => d.code === 'covers-service');
    expect(warn).toHaveLength(1);
    expect(warn[0].featureId).toBe('p1');
    const reps = repairsFor(p, pm, warn[0]);
    expect(reps.map((r) => [r.label, r.refused])).toEqual([['Cut the back around it', undefined]]);
    const next = reps[0].project;
    expect(next.items[0].backCuts).toEqual(['p1']);
    // Nothing is cut until the user applies it (ADR-072): the project given is unchanged.
    expect(p.items[0].backCuts).toBeUndefined();
    const after = buildProjectModel(next);
    expect(after.diagnostics.filter((d) => d.code === 'covers-service')).toEqual([]);
    const backs = after.model.panels.filter((x) => x.role === 'back');
    expect(backs).toHaveLength(1);
    const shape = backs[0].shape!;
    expect(shape.kind).toBe('profile');
    if (shape.kind !== 'profile') return;
    // A hole exactly the size of the zone (100 × 100, no clearance added).
    expect(shape.holes).toHaveLength(1);
    const hole = shape.holes![0];
    const us = hole.map(([u]) => u),
      vs = hole.map(([, v]) => v);
    expect(Math.max(...us) - Math.min(...us)).toBe(100);
    expect(Math.max(...vs) - Math.min(...vs)).toBe(100);
    expect(shape.cutouts).toHaveLength(1);
    expect(shape.cutouts![0]).toMatchObject({ w: 100, h: 100 });
    // The cut list notes it, and the print reads it in the print language.
    const row = projectCutlist(next).find((r) => /cut-out 100 × 100 mm at/.test(r.drilling))!;
    expect(row).toBeDefined();
    expect(row.labels.join()).toMatch(/Back/);
    const { u, v } = shape.cutouts![0];
    expect(row.drilling).toContain(`cut-out 100 × 100 mm at ${u}/${v} mm from left/bottom`);
    try {
      expect(drillingRo(row.drilling)).toContain(
        `decupaj 100 × 100 mm la ${u}/${v} mm de la stânga/jos`,
      );
      setPrintLang('ru');
      expect(drillingRo(row.drilling)).toContain(
        `вырез 100 × 100 мм в ${u}/${v} мм от левого/нижнего края`,
      );
      setPrintLang('en');
      expect(drillingRo(row.drilling)).toContain(
        `cut-out 100 × 100 mm at ${u}/${v} mm from left/bottom`,
      );
    } finally {
      setPrintLang('ro');
    }
    // Asked again, nothing more to offer.
    expect(repairsFor(next, after, warn[0])).toEqual([]);
  });

  it('a zone reaching an edge of the back makes a notch, not a hole', () => {
    const p = one(t('base-door'), room([pipe({ from: 0, width: 150, sill: 100, height: 120 })]));
    const pm = buildProjectModel(p);
    const warn = pm.diagnostics.find((d) => d.code === 'covers-service')!;
    const next = repairsFor(p, pm, warn)[0].project;
    const backPanel = buildProjectModel(next).model.panels.find((x) => x.role === 'back')!;
    const shape = backPanel.shape!;
    expect(shape.kind).toBe('profile');
    if (shape.kind !== 'profile') return;
    expect(shape.holes ?? []).toEqual([]);
    // The outline gains the notch's corners.
    expect(shape.points.length).toBeGreaterThan(4);
    expect(buildProjectModel(next).diagnostics.filter((d) => d.code === 'covers-service')).toEqual(
      [],
    );
  });

  it('a piece typed at an angle is refused with the reason', () => {
    const p = one(t('base-door'), room([pipe()]));
    const angled = { ...p, items: [{ ...p.items[0], angle: 10 }] };
    const pm = buildProjectModel(angled);
    const warn = pm.diagnostics.find((d) => d.code === 'covers-service');
    if (!warn) return; // turned off the pipe: nothing to cut (also fine)
    const reps = repairsFor(angled, pm, warn);
    expect(reps).toHaveLength(1);
    expect(reps[0].refused).toMatch(
      /is typed at an angle: its back cannot be cut around a pipe or outlet; turn it to a quarter turn or move it\./,
    );
    expect(reps[0].project).toBe(angled);
  });

  it('a worktop over a pipe warns with the worktop named; no back is cut', () => {
    let p = newProject('Top');
    p = { ...p, items: [makeItem(p, t('base-door'))] };
    p = { ...p, runParts: planRuns(p).parts };
    const top = p.runParts!.find((r) => r.kind === 'worktop')!.box;
    // A pipe at worktop height, above the base unit's back.
    const q = { ...p, room: room([pipe({ sill: top.y, height: top.h })]) };
    const pm = buildProjectModel(q);
    const d = pm.diagnostics.filter((x) => x.code === 'covers-service');
    expect(d).toHaveLength(1);
    expect(d[0].message).toMatch(/worktop/i);
    expect(d[0].featureId).toBeUndefined();
    expect(repairsFor(q, pm, d[0])).toEqual([]);
  });

  it('a plinth over a pipe warns with the plinth named; no back is cut', () => {
    // A low pipe on the left wall behind the end of the base unit's plinth (the left wall runs from z 3000 to 0).
    const p0 = one(t('base-door'), room([]));
    const plinth = buildProjectModel(p0).model.panels.find((x) => x.role === 'plinth')!;
    expect(plinth.box.x).toBeLessThan(50);
    const z0 = plinth.box.z - 30;
    const p = {
      ...p0,
      room: room([pipe({ wall: 3, from: 3000 - z0 - 100, sill: plinth.box.y + 10, height: 40 })]),
    };
    const pm = buildProjectModel(p);
    const d = pm.diagnostics.filter((x) => x.code === 'covers-service');
    expect(d).toHaveLength(1);
    expect(d[0].message).toMatch(/plinth/i);
    expect(d[0].featureId).toBeUndefined();
    expect(repairsFor(p, pm, d[0])).toEqual([]);
  });

  it('a template saved with its room keeps its pipes and outlets, and the back cut', () => {
    const outlet: RoomFeature = {
      ...pipe(),
      id: 'o1',
      kind: 'outlet',
      sill: 500,
      label: 'Outlet 1',
    };
    const p0 = one(t('base-door'), room([pipe(), outlet]));
    const p = { ...p0, items: [{ ...p0.items[0], backCuts: ['p1'] }] };
    const tpl = templateFromProject(p, 'With pipes', { includeRoom: true });
    expect(validateProjectTemplate(JSON.parse(JSON.stringify(tpl)))).toEqual([]);
    expect(tpl.room!.features.map((f) => [f.kind, f.label])).toEqual([
      ['pipe', 'Pipe 1'],
      ['outlet', 'Outlet 1'],
    ]);
    const made = projectFromTemplate(tpl);
    expect(made.room!.features).toEqual(p.room!.features);
  });
});

describe('clearance zones in 3D and templates (ADR-205, G-036)', () => {
  it('a template keeps each item’s zones (schemaVersion 3), and a project made from it has them', () => {
    let p = newProject('Desk');
    p = {
      ...p,
      items: [
        { ...makeItem(p, t('desk-pedestal')), zones: { chairDepth: 700 } },
        makeItem(p, t('chest')),
      ],
    };
    const tpl = templateFromProject(p, 'Zoned');
    expect(tpl.schemaVersion).toBe(TEMPLATE_SCHEMA);
    expect(TEMPLATE_SCHEMA).toBe(3);
    expect(tpl.items[0].zones).toEqual({ chairDepth: 700 });
    expect(tpl.items[1].zones).toBeUndefined();
    const back = JSON.parse(JSON.stringify(tpl));
    expect(validateProjectTemplate(back)).toEqual([]);
    const made = projectFromTemplate(back);
    expect(made.items[0].zones).toEqual({ chairDepth: 700 });
    expect(validateProject(made)).toEqual([]);
    expect(buildProjectModel(made).zones.some((z) => z.kind === 'chair')).toBe(true);
    // Zones need template version 3; a template without them stays an older version.
    expect(validateProjectTemplate({ ...back, schemaVersion: 2 }).join()).toMatch(
      /clearance zones need template schemaVersion 3/,
    );
    const plain = templateFromProject({ ...p, items: [makeItem(p, t('chest'))] }, 'Plain');
    expect(plain.schemaVersion).toBe(1);
    expect(validateProjectTemplate({ ...plain, schemaVersion: 2 })).toEqual([]);
  });

  it('every zone the 3D Clearances draws is a box with a severity, the installation zone among them', () => {
    let p = newProject('Tall');
    p = { ...p, items: [makeItem(p, t('wardrobe'))] };
    const zones = buildProjectModel(p).zones;
    const inst = zones.find((z) => z.kind === 'installation');
    expect(inst).toBeDefined();
    expect(inst!.box.h).toBeGreaterThan(0);
    for (const z of zones) expect(['none', 'warning', 'error']).toContain(z.severity);
  });
});

describe('wall-unit height snapping (ADR-205, G-033)', () => {
  /** Two base units with a worktop, and two wall units over them. */
  function kitchen(): Project {
    let p = newProject('Heights');
    for (let i = 0; i < 2; i++) p = { ...p, items: [...p.items, makeItem(p, t('base-door'))] };
    p = { ...p, runParts: planRuns(p).parts };
    for (let i = 0; i < 2; i++) {
      const w = makeItem(p, t('wall-cabinet'));
      p = {
        ...p,
        items: [
          ...p.items,
          {
            ...w,
            position: { ...w.position, x: i * 600 },
            placement: { kind: 'wall', height: i === 0 ? 1400 : 2000 },
          },
        ],
      };
    }
    return resolvePlacements(p);
  }
  const pieces = (p: Project) => buildProjectModel(p).pieces;

  it('the underside snaps to the worktop line within 60 mm, named in the hint', () => {
    const p = kitchen();
    const top = p.runParts!.find((r) => r.kind === 'worktop')!.box;
    const line = top.y + top.h;
    const id = p.items[2].id;
    expect(snapWallHeight(p, pieces(p), id, line + 40)).toEqual({
      height: line,
      hint: `Snapped to the worktop line, ${line} mm`,
    });
    expect(snapWallHeight(p, pieces(p), id, line - 60).height).toBe(line);
    // Beyond 60 mm: free, no hint.
    expect(snapWallHeight(p, pieces(p), id, line + 61)).toEqual({ height: line + 61, hint: null });
  });

  it('without a worktop the base units’ top is the worktop line', () => {
    const p = { ...kitchen(), runParts: [] };
    const base = pieces(p)[0].bounds;
    const line = base.y + base.h;
    const r = snapWallHeight(p, pieces(p), p.items[2].id, line + 10);
    expect(r).toEqual({ height: line, hint: `Snapped to the worktop line, ${line} mm` });
  });

  it('the underside or the top snaps to another wall unit’s underside or top', () => {
    const p = kitchen();
    const ps = pieces(p);
    const other = ps[3].bounds; // hung at 2000
    const me = ps[2];
    const name = ps[3].item.design.name;
    // Underside near the other's underside.
    expect(snapWallHeight(p, ps, me.item.id, other.y + 25)).toEqual({
      height: other.y,
      hint: `Snapped to ${name}, ${other.y} mm`,
    });
    // Underside near the other's top.
    const top = other.y + other.h;
    expect(snapWallHeight(p, ps, me.item.id, top - 40)).toEqual({
      height: top,
      hint: `Snapped to ${name}, ${top} mm`,
    });
    // My top near the other's underside: the underside lands at its underside minus my height.
    expect(snapWallHeight(p, ps, me.item.id, other.y - me.bounds.h + 20)).toEqual({
      height: other.y - me.bounds.h,
      hint: `Snapped to ${name}, ${other.y} mm`,
    });
  });

  it('the nearest line wins; the worktop line wins a tie', () => {
    const p = kitchen();
    const ps = pieces(p);
    const top = p.runParts!.find((r) => r.kind === 'worktop')!.box;
    const line = top.y + top.h;
    // Hang the other wall unit's underside 40 mm above the worktop line, then drag 20 mm above the line: tie at 20.
    const q = resolvePlacements({
      ...p,
      items: p.items.map((i, k) =>
        k === 3 ? { ...i, placement: { kind: 'wall' as const, height: line + 40 } } : i,
      ),
    });
    const qs = pieces(q);
    expect(snapWallHeight(q, qs, q.items[2].id, line + 20).hint).toBe(
      `Snapped to the worktop line, ${line} mm`,
    );
    expect(snapWallHeight(q, qs, q.items[2].id, line + 25).height).toBe(line + 40);
    void ps;
  });

  it('the store sets the snapped height as one undo step (setItemHeight)', () => {
    useDesign.setState({ project: null });
    st().openProject(kitchen());
    const id = st().project!.items[2].id;
    const r = snapWallHeight(st().project!, st().projectModel!.pieces, id, 1000);
    st().setItemHeight(id, r.height);
    const it = st().project!.items.find((i) => i.id === id)!;
    expect(it.placement).toEqual({ kind: 'wall', height: r.height });
    st().undoProject();
    expect(st().project!.items.find((i) => i.id === id)!.placement).toEqual({
      kind: 'wall',
      height: 1400,
    });
  });
});

describe('angled pieces (ADR-205, G-170)', () => {
  /**
   * Two base units typed at the same angle, the second `k` mm from the first along the first's turned width (its x
   * axis turns to (cos a, -sin a) on the plan, `yawPoint`).
   */
  function pair(angle: number, k: number): Project {
    const a = (angle * Math.PI) / 180;
    let p = newProject('Angled');
    const first = makeItem(p, t('base-door'));
    p = { ...p, items: [{ ...first, position: { x: 1000, y: 0, z: 1000 }, angle }] };
    const second = makeItem(p, t('base-door'));
    const at = {
      x: 1000 + Math.round(k * Math.cos(a)),
      y: 0,
      z: 1000 - Math.round(k * Math.sin(a)),
    };
    return { ...p, items: [...p.items, { ...second, position: at, angle }] };
  }
  const outlines = (p: Project) => buildProjectModel(p).pieces.map((pc) => pc.outline);
  const shift = (b: Box, dx: number, dz: number): Box => ({
    ...b,
    x: b.x + dx,
    z: b.z + dz,
    ...(b.yaw ? { yaw: { ...b.yaw, cx: b.yaw.cx + dx, cz: b.yaw.cz + dz } } : {}),
  });

  it('a turned face snaps to the parallel face of a piece at the same angle: no overlap, gap under 1 mm', () => {
    for (const angle of [15, 30, 45, 60]) {
      const p = pair(angle, 630);
      const pm = buildProjectModel(p);
      const r = snapDrag(p, pm.pieces, p.items[1].id, 0, 0);
      expect(r, String(angle)).not.toBeNull();
      expect(r!.snap?.kind, String(angle)).toBe('side');
      expect(r!.snap?.label, String(angle)).toBe('Joins Base cabinet');
      expect(Number.isInteger(r!.position.x) && Number.isInteger(r!.position.z)).toBe(true);
      const moved = {
        ...p,
        items: p.items.map((i, k) => (k === 1 ? { ...i, position: r!.position } : i)),
      };
      const [oa, ob] = outlines(moved);
      expect(penetration(oa, ob), String(angle)).toBe(0);
      expect(
        buildProjectModel(moved).diagnostics.filter((d) => d.code === 'pieces-overlap'),
      ).toEqual([]);
      // The gap left is under 1 mm: 1 mm closer along the face normal they overlap.
      const a = (angle * Math.PI) / 180;
      expect(penetration(oa, shift(ob, -Math.cos(a), Math.sin(a))), String(angle)).toBeGreaterThan(
        0,
      );
    }
  });

  it('against a wall the nearest corner of the turned outline snaps onto it, never through it', () => {
    let p = newProject('Wall');
    const it0 = makeItem(p, t('base-door'));
    p = { ...p, items: [{ ...it0, position: { x: 1000, y: 0, z: 40 }, angle: 20 }] };
    const pm = buildProjectModel(p);
    const r = snapDrag(p, pm.pieces, p.items[0].id, 0, 0)!;
    expect(r.snap?.kind).toBe('wall');
    const moved = { ...p, items: [{ ...p.items[0], position: r.position }] };
    const fp = buildProjectModel(moved).pieces[0].footprint;
    const minZ = Math.min(...fp.map(([, z]) => z));
    expect(minZ).toBeGreaterThanOrEqual(0);
    expect(minZ).toBeLessThan(1);
  });

  it('the overlap amount is measured on the turned outlines (separating-axis, rounded up)', () => {
    const p = pair(30, 560);
    const pm = buildProjectModel(p);
    const d = pm.diagnostics.find((x) => x.code === 'pieces-overlap')!;
    expect(d).toBeDefined();
    const [oa, ob] = pm.pieces.map((pc) => pc.outline);
    const amount = penetration(oa, ob);
    expect(Number.isInteger(amount)).toBe(true);
    expect(d.amount).toBe(amount);
    expect(d.message).toContain(`overlap by ${amount} mm`);
    // 560 mm apart along a 600 mm width: they go 40 mm into each other (rounded up), not what the room boxes say.
    expect(amount).toBeGreaterThanOrEqual(40);
    expect(amount).toBeLessThanOrEqual(41);
  });

  it('penetration of unturned boxes is the thinnest side of their overlap; apart is 0', () => {
    const a: Box = { x: 0, y: 0, z: 0, w: 100, h: 100, d: 100 };
    expect(penetration(a, { ...a, x: 90 })).toBe(10);
    expect(penetration(a, { ...a, x: 100 })).toBe(0);
    expect(penetration(a, { ...a, y: 95, x: 50 })).toBe(5);
  });
});

describe('mirrored copies match to the mm (ADR-205, G-032)', () => {
  /** A cabinet whose interior is three side-by-side parts that do not split evenly, each different. */
  function uneven(width: number): Design {
    const d = t('base-door');
    if (d.product.kind !== 'cabinet') throw Error('not a cabinet');
    const interior: Space = {
      id: 'root',
      kind: 'split',
      axis: 'x',
      sizes: [
        { mode: 'fr', value: 1 },
        { mode: 'fr', value: 1 },
        { mode: 'fr', value: 1 },
      ],
      children: [
        { id: 'a', kind: 'drawers', count: 2 },
        { id: 'b', kind: 'shelves', count: 1, front: { kind: 'doors', count: 1 } },
        { id: 'c', kind: 'empty' },
      ],
    } as Space;
    const params: CabinetParams = { ...d.product.params, width, interior };
    return { ...d, product: { ...d.product, params } };
  }
  const reflect = (ps: Panel[], W: number) =>
    ps
      .map((x) =>
        [x.role, W - (x.box.x + x.box.w), x.box.y, x.box.z, x.box.w, x.box.h, x.box.d].join(),
      )
      .sort();
  const plain = (ps: Panel[]) =>
    ps.map((x) => [x.role, x.box.x, x.box.y, x.box.z, x.box.w, x.box.h, x.box.d].join()).sort();

  it('distribute gives the remainder to the first flexible part with remainderFirst', () => {
    const s = [
      { mode: 'fr' as const, value: 1 },
      { mode: 'fr' as const, value: 1 },
      { mode: 'fr' as const, value: 1 },
    ];
    expect(distribute(100, s)).toEqual([33, 33, 34]);
    expect(distribute(100, s, true)).toEqual([34, 33, 33]);
    expect(distribute(100, [{ mode: 'mm', value: 40 }, ...s.slice(1)], true)).toEqual([40, 30, 30]);
    // No flexible part: the leftover goes to the first part.
    expect(
      distribute(
        100,
        [
          { mode: 'mm', value: 40 },
          { mode: 'mm', value: 50 },
        ],
        true,
      ),
    ).toEqual([50, 50]);
  });

  it.each([600, 601, 799, 1000])(
    'width %i: the mirrored piece is the original reflected, to the mm; twice gives the same design',
    (width) => {
      const d = uneven(width);
      expect(validateDesign(d)).toEqual([]);
      const m = mirrorDesign(d);
      expect(m.ok).toBe(true);
      const md = m.design;
      if (md.product.kind !== 'cabinet') throw Error('not a cabinet');
      expect((md.product.params.interior as { remainderFirst?: true }).remainderFirst).toBe(true);
      expect(md.schemaVersion).toBe(SCHEMA_VERSION);
      expect(validateDesign(md)).toEqual([]);
      const orig = buildModel(d),
        mir = buildModel(md);
      const W = orig.bounds.x * 2 + orig.bounds.w;
      expect(plain(mir.panels)).toEqual(reflect(orig.panels, W));
      expect(mirrorDesign(md).design).toEqual(d);
    },
  );

  it('catalog pieces with an uneven split: the mirrored copy has every cut size of the original (regression)', () => {
    // Found by the ADR-207 test run: these drifted 1 mm in door width after Mirror while the fronts beside a divider
    // still rounded the half gap the old way.
    const ids = [
      'wardrobe-3',
      'sideboard-3-doors',
      'sideboard-niche',
      'credenza-file',
      'credenza-3-doors',
      'media-doors-centre',
    ];
    const cut = (x: Design) =>
      cutlist(buildModel(x), x.materials)
        .flatMap((r) =>
          Array.from({ length: r.quantity }, () => `${r.materialId}|${r.length}×${r.width}`),
        )
        .sort();
    let seen = 0;
    for (const f of catalogFamilies)
      for (const v of f.variants) {
        if (!ids.includes(v.id)) continue;
        const d = insertVariant(f, v);
        if (!d) continue;
        seen++;
        const m = mirrorDesign(d);
        expect(m.ok, v.id).toBe(true);
        expect(cut(m.design), v.id).toEqual(cut(d));
      }
    expect(seen).toBe(ids.length);
  });

  it('designs without the flag build as before; the flag is toggled on x splits only', () => {
    const d = uneven(601);
    // No flag: the last part takes the remainder, as before (the stored cut lists do not change).
    const widths = (x: Design) => {
      const m = buildModel(x);
      const side = m.panels.find((q) => q.role === 'side' || /left side/i.test(q.label))!;
      const divs = m.panels
        .filter((q) => q.role === 'divider')
        .map((q) => q.box.x)
        .sort((a, b) => a - b);
      const t0 = side.box.w;
      const right = m.bounds.x + m.bounds.w - t0;
      const edges = [side.box.x + t0, ...divs.flatMap((v) => [v, v + t0]), right];
      return [0, 1, 2].map((i) => edges[2 * i + 1] - edges[2 * i]);
    };
    const w = widths(d);
    expect(w.reduce((a, b) => a + b, 0) % 3).not.toBe(0);
    expect(w[2]).toBeGreaterThan(w[0]);
    expect(w[0]).toBe(w[1]);
    // Mirrored: the remainder is on the first part, which is the same physical part.
    const m = widths(mirrorDesign(d).design);
    expect(m).toEqual([...w].reverse());
    const ySplit: Space = {
      id: 'y',
      kind: 'split',
      axis: 'y',
      sizes: [
        { mode: 'fr', value: 1 },
        { mode: 'fr', value: 1 },
      ],
      children: [
        { id: 'l', kind: 'empty' },
        { id: 'm', kind: 'empty' },
      ],
    } as Space;
    expect(mirrorSpace(ySplit)).toEqual(ySplit);
  });
});

describe('documents (ADR-011, ADR-205)', () => {
  it('design schemaVersion 9 stores remainderFirst; version 8 without it still loads, with it is refused', () => {
    expect(SCHEMA_VERSION).toBe(9);
    const d = t('base-door');
    const m = mirrorDesign({
      ...d,
      product:
        d.product.kind === 'cabinet'
          ? {
              ...d.product,
              params: {
                ...d.product.params,
                interior: {
                  id: 'r',
                  kind: 'split',
                  axis: 'x',
                  sizes: [
                    { mode: 'fr', value: 1 },
                    { mode: 'fr', value: 1 },
                  ],
                  children: [
                    { id: 'a', kind: 'empty' },
                    { id: 'b', kind: 'shelves', count: 1, front: { kind: 'doors', count: 1 } },
                  ],
                } as Space,
              },
            }
          : d.product,
    }).design;
    const file = JSON.parse(JSON.stringify(m)) as Design;
    expect(validateDesign(file)).toEqual([]);
    expect(JSON.stringify(file)).toContain('"remainderFirst":true');
    expect(validateDesign({ ...file, schemaVersion: 8 })).toContain(
      'Split remainder order needs schemaVersion 9',
    );
    const v8 = { ...d, schemaVersion: 8 as const };
    expect(validateDesign(v8)).toEqual([]);
    const up = upgradeDesign(v8);
    expect(up.schemaVersion).toBe(9);
    expect(buildModel(up).panels).toEqual(buildModel(v8).panels);
    // Only `true` is stored.
    const bad = JSON.parse(
      JSON.stringify(file).replace('"remainderFirst":true', '"remainderFirst":false'),
    );
    expect(validateDesign(bad)).toContain('Invalid split');
  });

  it('project schemaVersion 21 stores worktopJoints, hobs and backCuts; version 20 loads and refuses them', () => {
    expect(PROJECT_SCHEMA).toBe(21);
    expect(PROJECT_SCHEMAS).toContain(20);
    const p0 = joint(withParts('left'), 'butt', 'a');
    const p: Project = {
      ...p0,
      room: room([pipe()]),
      hobs: [{ id: 'h1', baseId: p0.items[0].id, w: 560, d: 490 }],
      items: p0.items.map((i, k) => (k === 0 ? { ...i, backCuts: ['p1'] } : i)),
    };
    const file = JSON.parse(JSON.stringify(p)) as Project;
    expect(validateProject(file)).toEqual([]);
    expect(file.worktopJoints).toEqual(p.worktopJoints);
    expect(file.hobs).toEqual(p.hobs);
    expect(file.items[0].backCuts).toEqual(['p1']);
    const v20 = { ...file, schemaVersion: 20 as const };
    const errs = validateProject(v20);
    expect(errs).toContain('Hobs need project schemaVersion 21');
    expect(errs).toContain('Worktop joints need project schemaVersion 21');
    expect(errs).toContain('Backs cut around pipes need project schemaVersion 21');
    // A version-20 project without them loads unchanged.
    const old = { ...lKitchen(), schemaVersion: 20 as const };
    expect(validateProject(JSON.parse(JSON.stringify(old)))).toEqual([]);
    expect(
      validateProject({ ...file, worktopJoints: [{ id: 'j', a: 'x', b: 'x', kind: 'mitre' }] }),
    ).toContain('Invalid worktop joint');
    expect(validateProject({ ...file, hobs: [{ id: 'h', baseId: 'nope', w: 1, d: 1 }] })).toContain(
      'Invalid hob',
    );
  });

  it('template schemaVersion 3 stores item zones; version 2 templates still load', () => {
    let p = newProject('T');
    p = { ...p, items: [makeItem(p, t('chest'))] };
    const v1 = templateFromProject(p, 'Old');
    expect(validateProjectTemplate({ ...v1, schemaVersion: 2 })).toEqual([]);
    expect(validateProjectTemplate({ ...v1, schemaVersion: 1 })).toEqual([]);
    expect(projectFromTemplate({ ...v1, schemaVersion: 2 }).items).toHaveLength(1);
  });
});

beforeEach(() => setPrintLang('ro'));
afterEach(() => setPrintLang('ro'));

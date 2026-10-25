import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import {
  buildProjectModel,
  makeItem,
  newProject,
  PROJECT_SCHEMA,
  planRuns,
  projectCutlist,
  refreshRunParts,
  requestKey,
  validateProject,
  type Project,
  type RunRequest,
} from '../src/core/project';
import { shapeOutline } from '../src/core/room';
import { partRo } from '../src/core/ro';
import type { CabinetParams, Design, Material } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const cab = (d: Design, patch: Partial<CabinetParams>): Design =>
  d.product.kind === 'cabinet'
    ? { ...d, product: { ...d.product, params: { ...d.product.params, ...patch } } }
    : d;

/** n pieces side by side, starting 100 mm from the wall (room for a left cover panel). */
function row(template: string, n: number, names: string[] = []): Project {
  let p = newProject('Row');
  for (let i = 0; i < n; i++) {
    const d = cab(t(template), {});
    p = { ...p, items: [...p.items, makeItem(p, { ...d, name: names[i] ?? d.name })] };
  }
  return {
    ...p,
    items: p.items.map((it) => ({ ...it, position: { ...it.position, x: it.position.x + 100 } })),
  };
}
const withRequests = (p: Project, rs: RunRequest[]): Project => {
  const q = {
    ...p,
    ...(rs.length ? { runRequests: rs } : {}),
    runSettings: { scribe: 0, auto: true },
  };
  return { ...q, runParts: planRuns(q).parts };
};
const board = (p: Project): Material => p.items[0].design.materials[0];
const room = (height: number) => ({
  height,
  outline: shapeOutline('rectangle', {
    width: 6000,
    depth: 4000,
    cutWidth: 0,
    cutDepth: 0,
    offset: 0,
  }),
  features: [],
});

describe('a worktop over part of a run (ADR-075)', () => {
  it('a worktop over two of four pieces spans exactly those two; the run worktop gives way', () => {
    const p0 = row('base-door', 4);
    const [, b, c] = p0.items;
    const p = withRequests(p0, [{ kind: 'worktop', from: [b.id, c.id] }]);
    const wts = p.runParts!.filter((r) => r.kind === 'worktop');
    expect(wts).toHaveLength(1);
    expect(wts[0].key).toBe(`worktop|${b.id},${c.id}`);
    expect(wts[0].box.x).toBe(b.position.x);
    expect(wts[0].box.w).toBe(1200);
    expect(wts[0].from).toEqual([b.id, c.id]);
    const pm = buildProjectModel(p);
    expect(pm.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const rows = projectCutlist(p).filter((r) => r.labels.includes('Run: Worktop'));
    expect(rows.map((r) => [r.length, r.quantity])).toEqual([[1200, 1]]);
  });
  it('the chosen worktop refreshes when its pieces move or are resized', () => {
    const p0 = row('base-door', 4);
    const [, b, c] = p0.items;
    const p = withRequests(p0, [{ kind: 'worktop', from: [b.id, c.id] }]);
    // c grows to 800 mm; d moves 200 mm right to make room.
    const fixed = refreshRunParts({
      ...p,
      items: p.items.map((it, i) =>
        it.id === c.id
          ? { ...it, design: cab(it.design, { width: 800 }) }
          : i === 3
            ? { ...it, position: { ...it.position, x: it.position.x + 200 } }
            : it,
      ),
    });
    const wt = fixed.runParts!.find((r) => r.kind === 'worktop')!;
    expect(wt.box.w).toBe(1400);
    expect(wt.changed).toBe('1200 → 1400 mm');
    expect(fixed.runParts!.filter((r) => r.kind === 'worktop')).toHaveLength(1);
  });
  it('pieces not next to each other: no worktop, an error naming them (never left out silently)', () => {
    const p0 = row('base-door', 4, ['A', 'B', 'C', 'D']);
    const [a, , c] = p0.items;
    const p = withRequests(p0, [{ kind: 'worktop', from: [a.id, c.id] }]);
    expect(p.runParts!.some((r) => r.kind === 'worktop')).toBe(false);
    const errs = buildProjectModel(p).diagnostics.filter((d) => d.code === 'run-request');
    expect(errs).toHaveLength(1);
    expect(errs[0].severity).toBe('error');
    expect(errs[0].message).toBe('Worktop over A + C: the pieces are not next to each other.');
  });
  it('two chosen worktops over the same piece: the second is an error, not a doubled worktop', () => {
    const p0 = row('base-door', 3, ['A', 'B', 'C']);
    const [a, b, c] = p0.items.map((i) => i.id);
    const p = withRequests(p0, [
      { kind: 'worktop', from: [a, b] },
      { kind: 'worktop', from: [b, c] },
    ]);
    expect(p.runParts!.filter((r) => r.kind === 'worktop')).toHaveLength(1);
    const errs = buildProjectModel(p).diagnostics.filter((d) => d.code === 'run-request');
    expect(errs.map((d) => d.message)).toEqual([
      'Worktop over B + C: it would overlap another worktop or run part.',
    ]);
  });
  it('a chosen worktop over part of a run says which pieces have none', () => {
    const p0 = row('base-door', 3, ['A', 'B', 'C']);
    const notes = planRuns({
      ...p0,
      runRequests: [{ kind: 'worktop', from: [p0.items[0].id] }],
    }).notes;
    expect(notes.join(' ')).toMatch(/No worktop over B \+ C/);
  });
  it('overhang changes the worktop size and position', () => {
    const p0 = row('base-door', 2);
    const ids = p0.items.map((i) => i.id);
    const plain = withRequests(p0, []).runParts!.find((r) => r.kind === 'worktop')!;
    const same = withRequests(p0, [
      { kind: 'worktop', from: ids, front: 20, side: 0 },
    ]).runParts!.find((r) => r.kind === 'worktop')!;
    // The defaults are today's values: the same box as the suggested worktop.
    expect(same.box).toEqual(plain.box);
    expect(same.key).toBe(plain.key);
    const wide = withRequests(p0, [
      { kind: 'worktop', from: ids, front: 40, side: 30 },
    ]).runParts!.find((r) => r.kind === 'worktop')!;
    expect(wide.box.x).toBe(plain.box.x - 30);
    expect(wide.box.w).toBe(plain.box.w + 60);
    expect(wide.box.d).toBe(plain.box.d + 20);
    expect(wide.box.z).toBe(plain.box.z);
    expect(wide.reason).toMatch(/overhang 40 mm front, 30 mm sides/);
  });
});

describe('crown, pelmet and ceiling filler (ADR-075)', () => {
  const walls = () => row('wall-cabinet', 3, ['W1', 'W2', 'W3']);
  it('crown and pelmet run along the fronts at the top and bottom with the height the user gave', () => {
    const p0 = walls();
    const ids = p0.items.map((i) => i.id);
    const m = board(p0);
    const p = withRequests(p0, [
      { kind: 'crown', from: ids, height: 60, material: m },
      { kind: 'pelmet', from: ids.slice(0, 2), height: 40, material: m },
    ]);
    const crown = p.runParts!.find((r) => r.kind === 'crown')!;
    const pelmet = p.runParts!.find((r) => r.kind === 'pelmet')!;
    const b = buildProjectModel(p).pieces.map((pc) => pc.bounds);
    const front = Math.max(...b.map((x) => x.z + x.d));
    expect(crown.box).toEqual({
      x: b[0].x,
      y: b[0].y + b[0].h,
      z: front - m.thickness,
      w: 2400,
      h: 60,
      d: m.thickness,
    });
    expect(pelmet.box).toEqual({
      x: b[0].x,
      y: b[0].y - 40,
      z: front - m.thickness,
      w: 1600,
      h: 40,
      d: m.thickness,
    });
    expect(buildProjectModel(p).diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const cut = projectCutlist(p);
    const crownRow = cut.find((r) => r.labels.includes('Run: Crown'))!;
    expect([crownRow.length, crownRow.width, crownRow.quantity]).toEqual([2400, 60, 1]);
    const pelmetRow = cut.find((r) => r.labels.includes('Run: Pelmet'))!;
    expect([pelmetRow.length, pelmetRow.width]).toEqual([1600, 40]);
    expect(partRo('Run: Crown')).toBe('Run: Cornișă');
    // Asking again with another board changes the board (refresh keeps the request's board for trims).
    const oak = p0.items[0].design.materials.find((x) => x.grain) ?? {
      ...m,
      name: 'Other',
      grain: true,
    };
    const again = refreshRunParts({
      ...p,
      runRequests: p.runRequests!.map((r) => (r.kind === 'crown' ? { ...r, material: oak } : r)),
    });
    expect(again.runParts!.find((r) => r.kind === 'crown')!.material.name).toBe(oak.name);
    // The crown follows the run: a fourth unit added to the request makes it longer.
    const more = row('wall-cabinet', 4);
    const p4 = withRequests(more, [
      { kind: 'crown', from: more.items.map((i) => i.id), height: 60, material: m },
    ]);
    expect(p4.runParts!.find((r) => r.kind === 'crown')!.box.w).toBe(3200);
  });
  it('the ceiling filler closes the gap from the run top (or its crown) to the room height', () => {
    const p0 = { ...walls(), room: room(2500) };
    const ids = p0.items.map((i) => i.id);
    const m = board(p0);
    const top = 1450 + 720;
    const alone = withRequests(p0, [{ kind: 'ceiling-filler', from: ids, material: m }]);
    const cf = alone.runParts!.find((r) => r.kind === 'ceiling-filler')!;
    expect([cf.box.y, cf.box.h, cf.box.w]).toEqual([top, 2500 - top, 2400]);
    const lower = withRequests({ ...p0, room: room(2400) }, [
      { kind: 'ceiling-filler', from: ids, material: m },
    ]);
    expect(lower.runParts!.find((r) => r.kind === 'ceiling-filler')!.box.h).toBe(2400 - top);
    // Asked for in either order, the filler goes above the crown.
    const stacked = withRequests(p0, [
      { kind: 'ceiling-filler', from: ids, material: m },
      { kind: 'crown', from: ids, height: 60, material: m },
    ]);
    const cf2 = stacked.runParts!.find((r) => r.kind === 'ceiling-filler')!;
    expect([cf2.box.y, cf2.box.h]).toEqual([top + 60, 2500 - top - 60]);
    expect(
      projectCutlist(stacked).find((r) => r.labels.includes('Run: Ceiling filler'))!.width,
    ).toBe(2500 - top - 60);
  });
  it('no room, a missing height or a pelmet below the floor are errors, not invented values', () => {
    const p0 = walls();
    const ids = p0.items.map((i) => i.id);
    const m = board(p0);
    const tall = row('wardrobe', 1, ['Tall']);
    const tid = tall.items[0].id;
    const cases: [Project, RunRequest, RegExp][] = [
      [p0, { kind: 'ceiling-filler', from: ids, material: m }, /set the room and its height/],
      [p0, { kind: 'crown', from: ids, material: m }, /enter its height/],
      [tall, { kind: 'pelmet', from: [tid], height: 50, material: m }, /50 mm below the floor/],
      [
        row('base-door', 2, ['Base']),
        { kind: 'crown', from: [], height: 50, material: m },
        /no longer in the project/,
      ],
    ];
    for (const [p, r, msg] of cases) {
      const q = withRequests(p, [r]);
      expect(q.runParts!.some((x) => x.kind === r.kind)).toBe(false);
      const errs = buildProjectModel(q).diagnostics.filter((d) => d.code === 'run-request');
      expect(errs.map((d) => d.severity)).toEqual(['error']);
      expect(errs[0].message).toMatch(msg);
    }
    const base = row('base-door', 1, ['Base']);
    const q = withRequests(base, [
      { kind: 'crown', from: [base.items[0].id], height: 50, material: m },
    ]);
    expect(buildProjectModel(q).diagnostics.find((d) => d.code === 'run-request')!.message).toBe(
      'Crown over Base: Base is not a wall or tall unit facing the room.',
    );
  });
});

describe('project schemaVersion 4 (ADR-075)', () => {
  it('new projects are the current version; version 1 files still load unchanged', () => {
    expect(newProject().schemaVersion).toBe(PROJECT_SCHEMA);
    const p = withRequests(row('base-door', 2), []);
    const v1 = { ...p, schemaVersion: 1 as const };
    expect(validateProject(v1)).toEqual([]);
    expect(buildProjectModel(v1).diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(validateProject({ ...p, schemaVersion: PROJECT_SCHEMA + 1 })).toContain(
      'Unsupported project schemaVersion',
    );
  });
  it('requests and trims validate in version 4 and are refused before it', () => {
    const p0 = row('wall-cabinet', 2);
    const ids = p0.items.map((i) => i.id);
    const p = withRequests(p0, [{ kind: 'crown', from: ids, height: 60, material: board(p0) }]);
    expect(validateProject(p)).toEqual([]);
    expect(validateProject({ ...p, schemaVersion: 1 })).toContain(
      'Trims and chosen worktops need project schemaVersion 4',
    );
    for (const bad of [
      { kind: 'cornice', from: ids },
      { kind: 'crown', from: [] },
      { kind: 'crown', from: ids, height: 0 },
      { kind: 'worktop', from: ids, front: -5 },
      { kind: 'worktop', from: ids, side: 1.5 },
    ])
      expect(validateProject({ ...p, runRequests: [bad] })).toContain('Invalid run request');
  });
});

describe('store: asking for run parts (ADR-075)', () => {
  const st = () => useDesign.getState();
  beforeEach(() => {
    const p = row('base-door', 4);
    st().openProject({ ...p, items: [], schemaVersion: 1 });
    for (const it of p.items) st().addPiece(it.design);
  });
  it('a chosen worktop is made at once in one undo step, bumps the version and follows a move', () => {
    const before = st().project!;
    const [, b, c] = before.items;
    st().setRunRequest({ kind: 'worktop', from: [b.id, c.id] });
    const p = st().project!;
    expect(p.schemaVersion).toBe(PROJECT_SCHEMA);
    expect(p.runSettings).toEqual({ scribe: 0, auto: true });
    expect(p.runParts!.filter((r) => r.kind === 'worktop').map((r) => r.box.w)).toEqual([1200]);
    st().setGap(c.id, 50, true);
    expect(st().project!.runParts!.find((r) => r.kind === 'worktop')!.box.w).toBe(1250);
    st().undoProject();
    st().undoProject();
    expect(st().project).toBe(before);
  });
  it('with refresh off the request is still made and the setting kept; removing the part drops the request', () => {
    st().setRunSettings({ auto: false });
    const ids = st().project!.items.map((i) => i.id);
    st().setRunRequest({ kind: 'worktop', from: ids.slice(0, 2), front: 30 });
    expect(st().project!.runSettings!.auto).toBe(false);
    const wt = st().project!.runParts!.find((r) => r.kind === 'worktop')!;
    expect(wt.key).toBe(requestKey({ kind: 'worktop', from: ids.slice(0, 2) }));
    st().removeRunPart(wt.id);
    expect(st().project!.runRequests).toEqual([]);
    expect(st().project!.runParts!.some((r) => r.kind === 'worktop')).toBe(false);
  });
  it('with refresh off, asking for a part adds only that part', () => {
    st().suggestRunParts();
    const ids = st().project!.items.map((i) => i.id);
    const cover = st().project!.runParts!.find((r) => r.kind === 'cover')!;
    st().removeRunPart(cover.id);
    st().setRunSettings({ auto: false });
    const before = st().project!.runParts!.filter((r) => r.kind !== 'worktop');
    st().setRunRequest({ kind: 'worktop', from: ids.slice(0, 2) });
    const after = st().project!.runParts!;
    expect(after.filter((r) => r.kind !== 'worktop')).toEqual(before);
    expect(after.filter((r) => r.kind === 'worktop').map((r) => r.from)).toEqual([ids.slice(0, 2)]);
  });
  it('removing a piece: its requests follow the pieces left', () => {
    const ids = st().project!.items.map((i) => i.id);
    st().setRunRequest({ kind: 'worktop', from: ids.slice(0, 2) });
    st().removeItem(ids[0]);
    expect(st().project!.runRequests).toEqual([{ kind: 'worktop', from: [ids[1]] }]);
    st().removeItem(ids[1]);
    expect(st().project!.runRequests).toEqual([]);
  });
});

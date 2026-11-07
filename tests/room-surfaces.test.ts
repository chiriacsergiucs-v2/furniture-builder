// Room surfaces, plan tracing and placed 3D models (ADR-208, N213): wall colour bands on the plan, the floor
// background, the wall behind a single piece, board pictures on the plan, the plan picture's scale, model placements,
// model drag and snap with one undo step, templates that keep models (and embed their files), and the 3D model
// library refusing to delete a model a saved template uses (ADR-012).
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import { makeModelItem, modelBox, type ModelItem } from '../src/core/model3d';
import { liftModel, modelDrop, moveModelTo } from '../src/core/modelPlace';
import { modelDrop as moveModeDrop } from '../src/core/drag3d';
import {
  newPlanPicture,
  planPictureProblems,
  planPictureRect,
  planScale,
  roomToPicture,
  type PlanPicture,
} from '../src/core/planPicture';
import {
  buildProjectModel,
  makeItem,
  newProject,
  pictureHolders,
  placeItem,
  placementIssues,
  PROJECT_SCHEMA,
  PROJECT_SCHEMAS,
  resolvePlacements,
  validateProject,
  type Project,
} from '../src/core/project';
import {
  projectFromTemplate,
  TEMPLATE_SCHEMA,
  templateFromProject,
  validateProjectTemplate,
} from '../src/core/projectTemplate';
import { insertTemplate } from '../src/core/insertTemplate';
import {
  floorRect,
  setWallFinish,
  shapeOutline,
  validateRoom,
  WALL_BAND,
  wallBands,
  type Room,
} from '../src/core/room';
import { topBoard, wallBehind } from '../src/core/roomSurfaces';
import {
  db,
  deleteModelIfUnused,
  loadModel,
  saveModel,
  saveProjectTemplate,
} from '../src/persist/db';
import { projectTemplateFile, readProjectTemplateFile } from '../src/persist/projectTemplateFile';
import { useDesign } from '../src/store/designStore';
import type { Design } from '../src/core/types';

const tpl = (id: string): Design => templates.find((x) => x.id === id)!.create();
const st = () => useDesign.getState();

const sizes = { width: 3000, depth: 2000, cutWidth: 0, cutDepth: 0, offset: 0 };
const room = (): Room => ({
  height: 2500,
  outline: shapeOutline('rectangle', sizes),
  features: [],
  shape: { kind: 'rectangle', sizes },
});

/** A project with a room and one base cabinet against the back wall, 400 mm from its left end. */
function withPiece(r: Room = room()): Project {
  const p = { ...newProject('Surfaces'), room: r };
  const it = makeItem(p, tpl('base-door'));
  return { ...p, items: [{ ...it, position: { ...it.position, x: 400, z: 0 } }] };
}

const fridge = (over: Partial<ModelItem> = {}): ModelItem => ({
  ...makeModelItem('m1', { id: 'mdl-1', name: 'Fridge', size: { w: 600, h: 1800, d: 600 } }, 0),
  ...over,
});

describe('wall colour bands on the plan (ADR-208 item 1)', () => {
  it('a 50 mm band inside each wall with a background, in its colour (a picture’s average colour)', () => {
    expect(WALL_BAND).toBe(50);
    let r = setWallFinish(room(), 0, {
      colour: '#4682a0',
      image: { id: 'img-w', name: 'tiles.png' },
    });
    r = setWallFinish(r, 1, { colour: '#e8b04a' });
    const bands = wallBands(r);
    expect(bands.map((b) => [b.wall, b.colour])).toEqual([
      [0, '#4682a0'],
      [1, '#e8b04a'],
    ]);
    // Wall 1 runs along the back (z = 0): the band lies just inside it, 50 mm deep, the wall's whole length.
    const back = bands[0].box;
    expect([back.x, back.z, back.w, back.d]).toEqual([0, 0, 3000, 50]);
    // Wall 2 is the right wall (x = 3000): 50 mm inside it, the room's whole depth.
    const right = bands[1].box;
    expect([right.x, right.z, right.w, right.d]).toEqual([2950, 0, 50, 2000]);
    // Walls without a background have no band; a broken outline draws none (never throws).
    expect(wallBands(room())).toEqual([]);
    expect(wallBands({ ...r, outline: [[0, 0]] })).toEqual([]);
  });
});

describe('floor background (ADR-208 item 2)', () => {
  const floor = { colour: '#a0805a', image: { id: 'img-floor', name: 'oak.png' } };
  it('validates, round-trips and is a picture holder; bad entries are problems, never exceptions', () => {
    const p = { ...withPiece(), room: { ...room(), floor } };
    expect(p.schemaVersion).toBe(PROJECT_SCHEMA);
    const back = JSON.parse(JSON.stringify(p)) as Project;
    expect(validateProject(back)).toEqual([]);
    expect(back.room!.floor).toEqual(floor);
    expect(
      pictureHolders(p).some((h) => h.materials.some((m) => m.image?.id === 'img-floor')),
    ).toBe(true);
    expect(validateRoom({ ...room(), floor: { colour: '#ffffff' } })).toEqual([]);
    for (const bad of [
      'oak',
      { colour: 'brown' },
      { colour: '#ffffff', image: { id: '', name: 'x' } },
      { colour: '#ffffff', image: { id: 'i', name: 'x', fit: { x: 0 } } },
    ])
      expect(() => validateRoom({ ...room(), floor: bad })).not.toThrow();
    for (const bad of [
      'oak',
      { colour: 'brown' },
      { colour: '#ffffff', image: { id: '', name: 'x' } },
    ])
      expect(validateRoom({ ...room(), floor: bad })).toContain('Invalid floor background');
  });
  it('older project versions load unchanged; a floor needs the version that stores it', () => {
    const p = withPiece();
    const plain = JSON.parse(JSON.stringify(p)) as Project;
    for (const v of PROJECT_SCHEMAS.filter((v) => v >= 14))
      expect(validateProject({ ...plain, schemaVersion: v as never })).toEqual([]);
    expect(
      validateProject({
        ...plain,
        schemaVersion: (PROJECT_SCHEMA - 1) as never,
        room: { ...plain.room!, floor },
      }),
    ).toContain(`Floor backgrounds need project schemaVersion ${PROJECT_SCHEMA}`);
  });
  it('a floor picture covers its fit in plan mm (x, then z as y), else the outline’s bounds', () => {
    const r = room();
    expect(floorRect(r, { id: 'i', name: 'n' })).toEqual({ x: 0, z: 0, w: 3000, d: 2000 });
    expect(floorRect(r, { id: 'i', name: 'n', fit: { x: 100, y: 200, w: 1000, h: 800 } })).toEqual({
      x: 100,
      z: 200,
      w: 1000,
      d: 800,
    });
  });
});

describe('the wall behind a single piece (ADR-208 item 3)', () => {
  it('the wall its back stands against, floor to room height, placed by its position along the wall', () => {
    const r = setWallFinish(room(), 0, { colour: '#4682a0' });
    const p = withPiece(r);
    const pc = placeItem(p.items[0]);
    const wb = wallBehind(p, pc)!;
    expect(wb).not.toBeNull();
    expect(wb.wall).toBe(0);
    expect(wb.finish.colour).toBe('#4682a0');
    expect(wb.height).toBe(2500);
    expect(wb.len).toBe(3000);
    expect(wb.floorY).toBe(-0);
    // 400 mm from the wall's left end, seen from inside the room.
    expect(wb.u0).toBe(400);
    const moved = placeItem({ ...p.items[0], position: { ...p.items[0].position, x: 1200 } });
    expect(wallBehind(p, moved)!.u0).toBe(1200);
  });
  it('nothing without a room, against a wall without a background, away from the wall or at an angle', () => {
    const p = withPiece();
    expect(wallBehind(p, placeItem(p.items[0]))).toBeNull();
    const r = setWallFinish(room(), 0, { colour: '#4682a0' });
    const q = withPiece(r);
    expect(wallBehind({ ...q, room: undefined }, placeItem(q.items[0]))).toBeNull();
    const away = { ...q.items[0], position: { ...q.items[0].position, z: 600 } };
    expect(wallBehind(q, placeItem(away))).toBeNull();
    // Facing wall 2 (the right wall), which has no background.
    const r2 = setWallFinish(room(), 2, { colour: '#e8b04a' });
    expect(wallBehind({ ...q, room: r2 }, placeItem(q.items[0]))).toBeNull();
    expect(wallBehind(q, undefined)).toBeNull();
  });
});

describe('board pictures on the plan (ADR-208 item 4)', () => {
  it('the board of the piece’s highest panel; the first in model order on a tie', () => {
    const p = withPiece();
    const pm = buildProjectModel(p);
    const pc = pm.pieces[0];
    const top = Math.max(...pc.panels.map((x) => x.box.y + x.box.h));
    const first = pc.panels.find((x) => x.box.y + x.box.h === top)!;
    expect(topBoard(pc)?.id).toBe(first.materialId);
    // A picture on that board is what the plan fills the footprint with, at its tile size.
    const d = structuredClone(p.items[0].design);
    const m = d.materials.find((x) => x.id === first.materialId)!;
    m.image = { id: 'img-oak', name: 'oak.png', tileLength: 600, tileWidth: 300 };
    const q = { ...p, items: [{ ...p.items[0], design: d }] };
    const board = topBoard(buildProjectModel(q).pieces[0])!;
    expect(board.image).toMatchObject({ id: 'img-oak', tileLength: 600, tileWidth: 300 });
    expect(topBoard({ ...pc, panels: [] })).toBeUndefined();
  });
});

describe('plan picture to trace over (ADR-208 item 5)', () => {
  const pp: PlanPicture = {
    id: 'img-plan',
    name: 'plan.jpg',
    a: [100, 50],
    b: [500, 50],
    length: 4000,
  };
  it('the scale comes from two taps and a typed known length; point a sits at room (0, 0)', () => {
    expect(planScale(pp)).toBe(10);
    expect(planPictureRect(pp, 1200, 800)).toEqual({ x: -1000, z: -500, w: 12000, d: 8000 });
    // A tap at room (3000, 2000) is that picture pixel (whole pixels).
    expect(roomToPicture(pp, 3000, 2000)).toEqual([400, 250]);
    expect(roomToPicture(pp, 0, 0)).toEqual([100, 50]);
    // Where it lies on the plan is whole mm (ADR-003): the plan frames and measures it.
    const odd = planPictureRect({ a: [1, 0], b: [4, 0], length: 1000 }, 10, 7);
    expect(odd).toEqual({ x: -333, z: 0, w: 3333, d: 2333 });
    for (const v of Object.values(odd)) expect(Number.isInteger(v)).toBe(true);
    // A diagonal known length works too: 3-4-5.
    expect(planScale({ a: [0, 0], b: [30, 40], length: 500 })).toBe(10);
    // The same point twice gives no scale, not a division by zero.
    expect(planScale({ a: [5, 5], b: [5, 5], length: 1000 })).toBe(0);
    // A new picture starts at 10 mm per pixel along its width.
    expect(newPlanPicture('i', 'n', 640)).toEqual({
      id: 'i',
      name: 'n',
      a: [0, 0],
      b: [640, 0],
      length: 6400,
    });
  });
  it('stored on the project; validated without throwing; integer mm only; older versions load', () => {
    const p: Project = { ...withPiece(), planPicture: pp };
    expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual([]);
    expect(validateProject({ ...p, planPicture: { ...pp, hidden: true } })).toEqual([]);
    expect(pictureHolders(p).some((h) => h.materials.some((m) => m.image?.id === 'img-plan'))).toBe(
      true,
    );
    for (const bad of [
      null,
      'plan',
      { ...pp, length: 12.5 },
      { ...pp, length: 0 },
      { ...pp, length: Number.NaN },
      { ...pp, length: '4000' },
      { ...pp, a: [1.5, 0] },
      { ...pp, a: [-1, 0] },
      { ...pp, b: [100, 50] },
      { ...pp, id: '' },
      { ...pp, hidden: false },
    ]) {
      expect(() => planPictureProblems(bad)).not.toThrow();
      expect(planPictureProblems(bad)).toEqual(['Invalid plan picture']);
      expect(validateProject({ ...p, planPicture: bad })).toContain('Invalid plan picture');
    }
    expect(validateProject({ ...p, schemaVersion: (PROJECT_SCHEMA - 1) as never })).toContain(
      `Plan pictures need project schemaVersion ${PROJECT_SCHEMA}`,
    );
  });
  it('Set the scale: two taps on the plan set a and b in one undo step; the same pixel twice changes nothing', () => {
    st().openProject({ ...withPiece(), planPicture: pp });
    const past = st().projectPast.length;
    st().startScalePlan();
    expect(st().scalingPlan).toEqual([]);
    st().addScalePoint([10, 20]);
    expect(st().scalingPlan).toEqual([[10, 20]]);
    expect(st().projectPast.length).toBe(past);
    st().addScalePoint([210, 20]);
    expect(st().scalingPlan).toBeNull();
    expect(st().project!.planPicture).toMatchObject({ a: [10, 20], b: [210, 20], length: 4000 });
    expect(planScale(st().project!.planPicture!)).toBe(20);
    expect(st().projectPast.length).toBe(past + 1);
    st().undoProject();
    expect(st().project!.planPicture).toEqual(pp);
    st().startScalePlan();
    st().addScalePoint([7, 7]);
    st().addScalePoint([7, 7]);
    expect(st().project!.planPicture).toEqual(pp);
    expect(st().scalingPlan).toBeNull();
  });
});

describe('placed 3D models (ADR-208 item 6)', () => {
  it('resolve on the floor, on the wall at a height and on a piece; a missing base is a warning, kept in place', () => {
    const p = withPiece();
    const base = p.items[0];
    const bb = placeItem(base).bounds;
    const models: ModelItem[] = [
      fridge({ id: 'f', position: { x: 2000, y: 300, z: 0 }, placement: { kind: 'floor' } }),
      fridge({
        id: 'w',
        position: { x: 2000, y: 0, z: 0 },
        placement: { kind: 'wall', height: 1450 },
      }),
      fridge({
        id: 'a',
        position: { x: 0, y: 0, z: 900 },
        placement: { kind: 'above', baseId: base.id, gap: 20, offsetX: 50 },
      }),
      fridge({ id: 'free', position: { x: 2500, y: 700, z: 900 } }),
    ];
    const r = resolvePlacements({ ...p, models });
    const at = (id: string) => r.models!.find((m) => m.id === id)!.position;
    expect(at('f').y).toBe(0);
    expect(at('w').y).toBe(1450);
    expect(at('a')).toEqual({ x: bb.x + 50, y: bb.y + bb.h + 20, z: bb.z });
    expect(at('free')).toEqual({ x: 2500, y: 700, z: 900 });
    // Resolving again changes nothing (the same project back).
    expect(resolvePlacements(r)).toBe(r);
    // The base piece moves: the model follows it.
    const moved = { ...r, items: [{ ...base, position: { ...base.position, x: 1000 } }] };
    expect(resolvePlacements(moved).models!.find((m) => m.id === 'a')!.position.x).toBe(1050);
    // The base is gone: a warning, and the model stays where it was.
    const gone = { ...r, items: [] };
    expect(resolvePlacements(gone).models!.find((m) => m.id === 'a')!.position).toEqual(at('a'));
    expect(placementIssues(gone).map((d) => d.code)).toContain('placement-base-missing');
  });
  it('validated as problems: a model is never a base; placements need the version that stores them', () => {
    const p = withPiece();
    const ok = {
      ...p,
      models: [fridge({ placement: { kind: 'above', baseId: p.items[0].id, gap: 0, offsetX: 0 } })],
    };
    expect(validateProject(JSON.parse(JSON.stringify(ok)))).toEqual([]);
    const onModel = {
      ...p,
      models: [
        fridge({ id: 'm1' }),
        fridge({ id: 'm2', placement: { kind: 'above', baseId: 'm1', gap: 0, offsetX: 0 } }),
      ],
    };
    expect(validateProject(onModel)).toContain('Invalid 3D model placement');
    for (const pl of [
      { kind: 'wall', height: -1 },
      { kind: 'wall' },
      { kind: 'roof' },
      'floor',
      { kind: 'above', baseId: p.items[0].id, gap: 0.5, offsetX: 0 },
    ]) {
      const bad = { ...p, models: [{ ...fridge(), placement: pl }] };
      expect(() => validateProject(bad)).not.toThrow();
      expect(validateProject(bad)).toContain('Invalid 3D model item');
    }
    expect(validateProject({ ...ok, schemaVersion: (PROJECT_SCHEMA - 1) as never })).toContain(
      `Placed 3D models need project schemaVersion ${PROJECT_SCHEMA}`,
    );
  });
  it('drag snaps to walls, pieces and other models within range; whole mm; Snap off moves in 10 mm steps', () => {
    const p = withPiece();
    const pieces = buildProjectModel(p).pieces;
    const pb = pieces[0].bounds;
    // A model in the open dragged to 50 mm off the back wall (within the 60 mm range) snaps against the wall.
    const m = fridge({ id: 'm', position: { x: 2000, y: 0, z: 1000 } });
    const proj = { ...p, models: [m] };
    const toWall = modelDrop(proj, pieces, 'm', 3, -953, true)!;
    expect(toWall.position.z).toBe(0);
    expect(toWall.snap).toMatch(/^Against /);
    // Snap off: whole 10 mm steps, nothing snaps.
    const free = modelDrop(proj, pieces, 'm', 3, -953, false)!;
    expect(free.position).toEqual({ x: 2000, y: 0, z: 50 });
    // 70 mm off is out of range: no snap, a hint instead.
    expect(modelDrop(proj, pieces, 'm', 0, -930, true)!.position.z).toBe(70);
    expect(free.snap).toBeNull();
    for (const v of Object.values(free.position)) expect(Number.isInteger(v)).toBe(true);
    // Next to the piece: its left side joins the piece's right side.
    const nearPiece = modelDrop(proj, pieces, 'm', pb.x + pb.w + 30 - 2000, -1000, true)!;
    expect(nearPiece.position.x).toBe(pb.x + pb.w);
    expect(nearPiece.snap).toMatch(/Joins /);
    // Next to another model: joins its side.
    const other = fridge({ id: 'o', name: 'Oven', position: { x: 2700, y: 0, z: 1000 } });
    const two = { ...p, models: [m, other] };
    const nearModel = modelDrop(two, pieces, 'm', 70, 0, true)!;
    expect(nearModel.position.x).toBe(2700 - 600);
    expect(nearModel.snap).toContain('Joins Oven');
    // Nothing in range: a hint, never a throw; an unknown model or NaN gives no move.
    const lone = { ...p, room: undefined, items: [], models: [m] };
    expect(modelDrop(lone, [], 'm', 0, 0, true)!.hint).toMatch(/Nothing to snap to within/);
    expect(modelDrop(proj, pieces, 'nope', 10, 10, true)).toBeNull();
    expect(modelDrop(proj, pieces, 'm', Number.NaN, 0, false)!.position.x).toBe(2000);
  });
  it('a dragged model is lifted off its piece onto the floor; one on the wall keeps its height', () => {
    expect(liftModel({ kind: 'above', baseId: 'b', gap: 0, offsetX: 0 })).toEqual({
      kind: 'floor',
    });
    expect(liftModel({ kind: 'wall', height: 1450 })).toEqual({ kind: 'wall', height: 1450 });
    expect(liftModel(undefined)).toBeUndefined();
    const p = withPiece();
    const on = fridge({
      id: 'm',
      position: { x: 400, y: 870, z: 0 },
      placement: { kind: 'above', baseId: p.items[0].id, gap: 0, offsetX: 0 },
    });
    const proj = { ...p, models: [on] };
    const d = modelDrop(proj, buildProjectModel(proj).pieces, 'm', 1500, 800, false)!;
    expect(d.position.y).toBe(0);
    const next = moveModelTo(proj, 'm', d.position);
    expect(next.models![0].placement).toEqual({ kind: 'floor' });
    expect(next.models![0].position).toEqual({ x: 1900, y: 0, z: 800 });
    expect(moveModelTo(proj, 'm', on.position)).toBe(proj);
  });
  it('a drop in the store (plan or Move mode) is one undo step; a drop that does not move makes none', () => {
    const p = {
      ...withPiece(),
      models: [fridge({ id: 'm', position: { x: 2000, y: 0, z: 1000 } })],
    };
    st().openProject(p);
    const before = st().project!;
    const past = st().projectPast.length;
    st().dropModel('m', 3, -953, true);
    expect(st().project!.models![0].position.z).toBe(0);
    expect(st().projectPast.length).toBe(past + 1);
    st().undoProject();
    expect(st().project).toBe(before);
    st().dropModel('m', 4, -4, false);
    expect(st().project).toBe(before);
    expect(st().projectPast.length).toBe(past);
  });
  it('Move mode (3D) previews the same drop as the plan: the same position and snap', () => {
    const p = {
      ...withPiece(),
      models: [fridge({ id: 'm', position: { x: 2000, y: 0, z: 1000 } })],
    };
    const pieces = buildProjectModel(p).pieces;
    const from = { x: 2300, z: 1300 },
      to = { x: 2303, z: 347 };
    const plan = modelDrop(p, pieces, 'm', to.x - from.x, to.z - from.z, true)!;
    const move = moveModeDrop(p, pieces, 'm', from, to, true)!;
    expect(move.position).toEqual(plan.position);
    expect(move.position.z).toBe(0);
    expect(move.snap?.label).toBe(plan.snap);
  });
});

describe('templates keep 3D models (ADR-208 item 6)', () => {
  const tmplOf = () => {
    const p = withPiece();
    const proj: Project = {
      ...p,
      models: [
        fridge({ id: 'f', position: { x: 1500, y: 0, z: 100 }, placement: { kind: 'floor' } }),
        fridge({
          id: 'a',
          name: 'Kettle',
          size: { w: 200, h: 250, d: 200 },
          position: { x: 450, y: 870, z: 0 },
          placement: { kind: 'above', baseId: p.items[0].id, gap: 0, offsetX: 50 },
          front: 'back',
        }),
      ],
    };
    return { proj, t: templateFromProject(proj, 'With models') };
  };
  it('saved with offsets and placement over refs, at the template version that stores them', () => {
    const { proj, t } = tmplOf();
    expect(t.schemaVersion).toBe(TEMPLATE_SCHEMA);
    expect(t.models).toHaveLength(2);
    const ox = Math.min(...proj.items.map((i) => i.position.x));
    expect(t.models![0]).toMatchObject({
      ref: 'f',
      modelId: 'mdl-1',
      offset: { x: 1500 - ox, y: 0, z: 100 },
    });
    expect(t.models![1].placement).toEqual({
      kind: 'above',
      baseId: proj.items[0].id,
      gap: 0,
      offsetX: 50,
    });
    expect(validateProjectTemplate(JSON.parse(JSON.stringify(t)))).toEqual([]);
    // Without models a template stays at an older version.
    expect(templateFromProject({ ...proj, models: undefined }, 'Plain').schemaVersion).toBe(1);
  });
  it('bad template models are problems, never exceptions', () => {
    const { t } = tmplOf();
    for (const bad of [
      'x',
      [{ ...t.models![0], ref: '' }],
      [{ ...t.models![0], offset: { x: 0.5, y: 0, z: 0 } }],
      [{ ...t.models![0], placement: { kind: 'above', baseId: 'not-a-ref', gap: 0, offsetX: 0 } }],
      [t.models![0], t.models![0]],
    ]) {
      expect(() => validateProjectTemplate({ ...t, models: bad })).not.toThrow();
      expect(validateProjectTemplate({ ...t, models: bad }).length).toBeGreaterThan(0);
    }
    expect(validateProjectTemplate({ ...t, schemaVersion: 2 }).length).toBeGreaterThan(0);
  });
  it('used as a project or inserted: new ids, the model on a piece follows that piece', () => {
    const { proj, t } = tmplOf();
    const back = projectFromTemplate(JSON.parse(JSON.stringify(t)));
    expect(validateProject(back)).toEqual([]);
    expect(back.models).toHaveLength(2);
    expect(back.models!.map((m) => m.id)).not.toContain('f');
    const kettle = back.models!.find((m) => m.name === 'Kettle')!;
    expect(kettle.front).toBe('back');
    expect(kettle.placement).toMatchObject({
      kind: 'above',
      baseId: back.items[0].id,
      offsetX: 50,
    });
    const resolved = resolvePlacements(back);
    const bb = placeItem(resolved.items[0]).bounds;
    expect(resolved.models!.find((m) => m.name === 'Kettle')!.position).toEqual({
      x: bb.x + 50,
      y: bb.y + bb.h,
      z: bb.z,
    });
    // Inserted into another project: it joins with new ids, moved with its block.
    const host = { ...newProject('Host') };
    const ins = insertTemplate(host, t, { x: 1000, z: 0 });
    expect(ins.project.models).toHaveLength(2);
    const k2 = ins.project.models!.find((m) => m.name === 'Kettle')!;
    expect(ins.ids).toContain((k2.placement as { baseId: string }).baseId);
    expect(ins.project.models!.find((m) => m.name === 'Fridge')!.position.x).toBe(
      1000 + 1500 - Math.min(...proj.items.map((i) => i.position.x)),
    );
  });
});

describe('template files and My 3D models (ADR-208 item 6, ADR-012)', () => {
  const glb = () => {
    // A .gltf with one triangle in an embedded buffer: it passes the file check on import (takeModels).
    const json = new TextEncoder().encode(
      JSON.stringify({
        asset: { version: '2.0' },
        meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
        accessors: [{ count: 3 }],
        buffers: [{ uri: 'data:application/octet-stream;base64,AAAA', byteLength: 3 }],
      }),
    );
    return json.slice().buffer;
  };
  beforeEach(async () => {
    await db.models.clear();
    await db.projects.clear();
    await db.projectTemplates.clear();
  });
  it('a model a saved template uses cannot be deleted; once the template is gone it can', async () => {
    await saveModel({
      id: 'mdl-1',
      name: 'Fridge',
      format: 'gltf',
      bytes: glb(),
      size: { w: 600, h: 1800, d: 600 },
      triangles: 0,
      createdAt: new Date().toISOString(),
    });
    const p = withPiece();
    const t = templateFromProject({ ...p, models: [fridge()] }, 'Kitchen block');
    await saveProjectTemplate(t);
    const r = await deleteModelIfUnused('mdl-1');
    expect(r.deleted).toBe(false);
    expect(r.usedBy).toEqual(['the project template Kitchen block']);
    expect(await loadModel('mdl-1')).toBeDefined();
    await db.projectTemplates.clear();
    expect((await deleteModelIfUnused('mdl-1')).deleted).toBe(true);
    expect(await loadModel('mdl-1')).toBeUndefined();
  });
  it('a template file embeds the model files; importing it stores them and gives the template new ids', async () => {
    await saveModel({
      id: 'mdl-1',
      name: 'Fridge',
      format: 'gltf',
      bytes: glb(),
      size: { w: 600, h: 1800, d: 600 },
      triangles: 0,
      createdAt: new Date().toISOString(),
    });
    const p = withPiece();
    const t = templateFromProject({ ...p, models: [fridge()] }, 'Kitchen block');
    const file = JSON.parse(JSON.stringify(await projectTemplateFile(t)));
    expect(file.models3d).toHaveLength(1);
    expect(file.models3d[0]).toMatchObject({ id: 'mdl-1', name: 'Fridge' });
    // On another device: the model is not there.
    await db.models.clear();
    const read = await readProjectTemplateFile(file);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.problems).toEqual([]);
    expect(read.template.id).not.toBe(t.id);
    expect((read.template as { models3d?: unknown }).models3d).toBeUndefined();
    const newModelId = read.template.models![0].modelId;
    expect(newModelId).not.toBe('mdl-1');
    expect(await loadModel(newModelId)).toBeDefined();
    expect(validateProjectTemplate(read.template)).toEqual([]);
  });
});

describe('model boxes stay whole mm (ADR-003)', () => {
  it('modelBox of a placed model', () => {
    const b = modelBox(fridge({ position: { x: 10, y: 20, z: 30 } }));
    expect(b).toEqual({ x: 10, y: 20, z: 30, w: 600, h: 1800, d: 600 });
  });
});

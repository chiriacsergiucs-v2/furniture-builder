import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { mirrorRun, setItemRotation } from '../src/core/arrange';
import { templates } from '../src/core/design';
import { box, enclosing, footprintOf, overlaps } from '../src/core/geometry';
import {
  buildProjectModel,
  makeItem,
  mirroredRotation,
  newProject,
  placedOutline,
  PROJECT_SCHEMA,
  resolvePlacements,
  rotationOf,
  roomToPiece,
  runHandleMembers,
  runOf,
  suggestRunParts,
  applyRunHandles,
  setLocked,
  splitRotation,
  validateProject,
  type Project,
} from '../src/core/project';
import { projectFromTemplate, templateFromProject } from '../src/core/projectTemplate';
import { mirrorItems } from '../src/core/selection';
import { catalogFamilies } from '../src/core/catalog';
import { resolveItem, syncRef } from '../src/core/ownEdits';
import { followProject, setProjectSetting } from '../src/core/projectSettings';
import { decodeCode, encodeCode } from '../src/core/shareCode';
import { importDocument } from '../src/ui/shell/importFile';
import { loadProject, saveProject } from '../src/persist/db';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
function run(ids: string[]): Project {
  let p = newProject('Angles');
  for (const id of ids) p = { ...p, items: [...p.items, makeItem(p, t(id))] };
  return resolvePlacements(p);
}
const codes = (p: Project) => buildProjectModel(p).diagnostics.map((d) => d.code);
const centre = (p: Project, id: string) => {
  const b = placedOutline(resolvePlacements(p).items.find((i) => i.id === id)!);
  return { x: b.x + b.w / 2, z: b.z + b.d / 2 };
};

describe('turned boxes (ADR-121)', () => {
  it('are tested exactly: touching along a turned edge is no overlap, 1 mm in is', () => {
    const yaw = { deg: 37, cx: 300, cz: 250 };
    const a = { ...box(0, 0, 0, 600, 800, 500), yaw };
    expect(overlaps(a, { ...box(600, 0, 0, 400, 800, 500), yaw })).toBe(false);
    expect(overlaps(a, { ...box(599, 0, 0, 400, 800, 500), yaw })).toBe(true);
    // Their enclosing boxes overlap all the same: the old axis-aligned test would have said overlap.
    expect(overlaps(enclosing(a), enclosing({ ...box(600, 0, 0, 400, 800, 500), yaw }))).toBe(true);
  });

  it('turn the way a quarter turn does: 90 takes the front (+z) to +x', () => {
    const f = footprintOf({ ...box(0, 0, 0, 100, 1, 100), yaw: { deg: 90, cx: 50, cz: 50 } });
    // The front-left corner (0, 100) goes to the right side.
    expect(f[3][0]).toBeCloseTo(100);
    expect(f[3][1]).toBeCloseTo(100);
  });

  it('split whole degrees into a quarter turn and an extra angle; mirroring makes θ into −θ', () => {
    expect(splitRotation(0)).toEqual({ rotationY: 0 });
    expect(splitRotation(135)).toEqual({ rotationY: 90, angle: 45 });
    expect(splitRotation(359)).toEqual({ rotationY: 270, angle: 89 });
    expect(splitRotation(360)).toBeNull();
    expect(splitRotation(-1)).toBeNull();
    expect(splitRotation(12.5)).toBeNull();
    expect(mirroredRotation({ rotationY: 0, angle: 30 })).toEqual({ rotationY: 270, angle: 60 });
    expect(mirroredRotation({ rotationY: 90 })).toEqual({ rotationY: 270 });
  });
});

describe('typed rotation of a project piece (ADR-121)', () => {
  it('turns about the centre in whole degrees and keeps position whole mm', () => {
    const p = run(['base-door']);
    const id = p.items[0].id;
    const before = centre(p, id);
    const r = setItemRotation(p, id, 30);
    expect(r.reason).toBeUndefined();
    const it = r.project.items[0];
    expect(rotationOf(it)).toBe(30);
    expect(it.angle).toBe(30);
    expect(centre(r.project, id)).toEqual(before);
    const r2 = setItemRotation(r.project, id, 120);
    expect(rotationOf(r2.project.items[0])).toBe(120);
    const c2 = centre(r2.project, id);
    expect(Math.abs(c2.x - before.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(c2.z - before.z)).toBeLessThanOrEqual(0.5);
    expect(Object.values(r2.project.items[0].position).every(Number.isInteger)).toBe(true);
  });

  it('refuses a number outside 0–359 and a locked piece, never clamps (ADR-008, ADR-095)', () => {
    const p = run(['base-door']);
    const id = p.items[0].id;
    expect(setItemRotation(p, id, 400).reason).toMatch(/0 to 359/);
    expect(setItemRotation(p, id, 400).project).toBe(p);
    const locked = setLocked(p, id, true);
    expect(setItemRotation(locked, id, 30).reason).toMatch(/is locked/);
  });

  it('checks overlaps on the turned piece: enclosing boxes may meet, the pieces do not', () => {
    const p = run(['base-door', 'base-door']);
    const [a, b] = p.items;
    expect(codes(p)).not.toContain('pieces-overlap');
    // Turned 45°, the first piece reaches past its old right side into the second.
    const turned = setItemRotation(p, a.id, 45).project;
    expect(codes(turned)).toContain('pieces-overlap');
    // The second piece set into the box around the turned one, 300 mm in front of its right-most corner: at 45° the
    // turned piece's sides have drawn back 300 mm there, so the boxes meet but the pieces do not.
    const pm = buildProjectModel(turned);
    const right = pm.pieces[0].footprint.reduce((m, q) => (q[0] > m[0] ? q : m));
    const near = {
      ...turned,
      items: turned.items.map((i) =>
        i.id === b.id
          ? {
              ...i,
              position: {
                ...i.position,
                x: Math.floor(right[0]) - 30,
                z: Math.ceil(right[1]) + 300,
              },
            }
          : i,
      ),
    };
    const pm2 = buildProjectModel(near);
    expect(overlaps(pm2.pieces[0].bounds, pm2.pieces[1].bounds)).toBe(true);
    expect(pm2.diagnostics.map((d) => d.code)).not.toContain('pieces-overlap');
    // 30 mm further left, level with the corner, they do overlap.
    const level = {
      ...near,
      items: near.items.map((i) =>
        i.id === b.id ? { ...i, position: { ...i.position, z: Math.floor(right[1]) - 10 } } : i,
      ),
    };
    expect(codes(level)).toContain('pieces-overlap');
    void b;
  });

  it('checks the room and door clearances on the turned piece', () => {
    let p = run(['base-door']);
    p = {
      ...p,
      room: {
        outline: [
          [0, 0],
          [3000, 0],
          [3000, 3000],
          [0, 3000],
        ],
        height: 2500,
        features: [],
      },
    } as Project;
    const id = p.items[0].id;
    const at = (x: number) => ({
      ...p,
      items: p.items.map((i) => ({ ...i, position: { ...i.position, x, z: 0 } })),
    });
    expect(codes(at(0))).not.toContain('outside-room');
    // At 30° against the back wall, a back corner goes through it.
    const turned = setItemRotation(at(500), id, 30).project;
    expect(codes(turned)).toContain('outside-room');
    // The door's swing zone turns with the piece.
    const pm = buildProjectModel(turned);
    expect(pm.pieces[0].clearances.every((c) => c.box.yaw?.deg === 30)).toBe(true);
  });

  it('keeps an angled piece out of runs, their worktops and run handles (G-171, ADR-125)', () => {
    const p = run(['base-door', 'base-door', 'base-door']);
    const ids = p.items.map((i) => i.id);
    expect(runOf(p, ids[2])).toEqual(ids);
    const turned = setItemRotation(p, ids[2], 10).project;
    const pm = buildProjectModel(turned);
    expect(pm.pieces[2].footprint).toHaveLength(4);
    expect(pm.pieces[2].outline.yaw?.deg).toBe(10);
    expect(runOf(turned, ids[2])).toBeNull();
    expect(suggestRunParts(turned).every((rp) => !rp.from?.includes(ids[2]))).toBe(true);
    // A run handle over all three reaches the two straight pieces only; the angled one keeps its own design.
    const handled: Project = {
      ...turned,
      schemaVersion: PROJECT_SCHEMA,
      runHandles: [{ id: 'rh', from: ids, handle: { kind: 'bar', holeSpacing: 128 }, height: 600 }],
    };
    expect(runHandleMembers(handled, handled.runHandles![0])).toEqual(ids.slice(0, 2));
    const built = applyRunHandles(handled);
    expect(built.items[2]).toBe(handled.items[2]);
    expect(built.items[0]).not.toBe(handled.items[0]);
  });

  it('maps a tap back into the piece through its angle (ADR-083)', () => {
    const p = run(['base-door']);
    const turned = setItemRotation(p, p.items[0].id, 30).project;
    const it = turned.items[0];
    const c = centre(turned, it.id);
    const back = roomToPiece(it, { x: c.x, y: 100, z: c.z });
    const plain = roomToPiece({ ...it, angle: undefined }, { x: c.x, y: 100, z: c.z });
    expect(back.x).toBeCloseTo(plain.x);
    expect(back.z).toBeCloseTo(plain.z);
  });
});

describe('saving pieces at an angle (ADR-011)', () => {
  it('needs schemaVersion 10; older projects with quarter turns still load', () => {
    const p = run(['base-door']);
    const turned = {
      ...setItemRotation(p, p.items[0].id, 30).project,
      schemaVersion: PROJECT_SCHEMA,
    };
    expect(PROJECT_SCHEMA).toBeGreaterThanOrEqual(10);
    expect(validateProject({ ...turned, schemaVersion: 10 })).toEqual([]);
    expect(validateProject(turned)).toEqual([]);
    expect(validateProject({ ...turned, schemaVersion: 9 })).toContain(
      'Pieces at an angle need project schemaVersion 10',
    );
    const old = { ...run(['base-door']), schemaVersion: 9 as const };
    expect(validateProject(old)).toEqual([]);
    expect(
      validateProject({ ...turned, items: [{ ...turned.items[0], angle: 90 }] }).join(),
    ).toMatch(/1 to 89/);
  });

  it('round-trips through IndexedDB and project templates', async () => {
    const p0 = run(['base-door', 'chest']);
    const p = { ...setItemRotation(p0, p0.items[0].id, 75).project, schemaVersion: PROJECT_SCHEMA };
    await saveProject(p);
    const back = await loadProject(p.id);
    expect(back?.items[0].angle).toBe(75);
    expect(back?.items[0].rotationY).toBe(0);
    const made = projectFromTemplate(templateFromProject(p, 'T'));
    expect(made.items.map((i) => rotationOf(i))).toEqual([75, 0]);
    expect(made.schemaVersion).toBe(PROJECT_SCHEMA);
    expect(validateProject(made)).toEqual([]);
  });
});

describe('mirror a selection (ADR-121, G-085)', () => {
  beforeEach(() => useDesign.getState().closeProject());

  it('mirrors positions and designs about the selection centre, angles become −θ', () => {
    const p0 = run(['base-door', 'base-door', 'chest']);
    const p = setItemRotation(p0, p0.items[0].id, 20).project;
    const ids = p.items.map((i) => i.id);
    const r = mirrorItems(p, ids);
    expect(r.refused).toBeUndefined();
    expect(rotationOf(r.project.items[0])).toBe(340);
    // Mirroring twice gives the same places and turns back.
    const twice = mirrorItems(r.project, ids).project;
    expect(twice.items.map((i) => i.position)).toEqual(p.items.map((i) => i.position));
    expect(twice.items.map(rotationOf)).toEqual(p.items.map(rotationOf));
    // The chest has nothing to mirror: it only moves, and says so.
    expect(r.reasons.join()).toMatch(/Chest/);
  });

  it('refuses when a selected piece is locked, naming it', () => {
    const p0 = run(['base-door', 'chest']);
    const p = setLocked(p0, p0.items[1].id, true);
    const r = mirrorItems(
      p,
      p.items.map((i) => i.id),
    );
    expect(r.project).toBe(p);
    expect(r.refused).toMatch(/^Mirror refused: .*Chest/);
  });

  it('is one undo step in the store; Mirror the run still works as before', () => {
    const p = run(['base-door', 'chest']);
    useDesign.getState().openProject(p);
    useDesign.getState().selectItems(p.items.map((i) => i.id));
    const before = useDesign.getState().project!;
    useDesign.getState().mirrorSelection();
    expect(useDesign.getState().project!.items[0].position.x).not.toBe(before.items[0].position.x);
    useDesign.getState().undoProject();
    expect(useDesign.getState().project!.items.map((i) => i.position)).toEqual(
      before.items.map((i) => i.position),
    );
    expect(mirrorRun(p, p.items[0].id).project.items[1].position.x).toBe(0);
  });
});

describe('angled pieces with ADR-124 (share codes, template references, project settings)', () => {
  const angled = (): Project => {
    const p0 = run(['base-door', 'chest']);
    return { ...setItemRotation(p0, p0.items[0].id, 75).project, schemaVersion: PROJECT_SCHEMA };
  };

  it('a share code round-trips an angled piece, also when opened as a new copy', async () => {
    const p = angled();
    const back = await decodeCode(await encodeCode(p));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(validateProject(back.doc)).toEqual([]);
    expect((back.doc as Project).items.map(rotationOf)).toEqual([75, 0]);
    const r = await importDocument(back.doc);
    expect(r.opened).toBe(true);
    const opened = useDesign.getState().project!;
    expect(opened.id).not.toBe(p.id);
    expect(opened.items.map(rotationOf)).toEqual([75, 0]);
    expect(opened.items[0].angle).toBe(75);
  });

  it('a template reference and a project setting keep the angle', () => {
    const p = angled();
    const it0 = { ...p.items[0], ref: { overrides: {} } };
    expect(syncRef(it0, catalogFamilies).angle).toBe(75);
    // The design is rebuilt from the template; the item and its angle stay as they are.
    const withRef: Project = { ...p, items: [it0, p.items[1]] };
    expect(buildProjectModel(withRef).pieces[0].outline.yaw?.deg).toBe(75);
    expect(resolveItem(it0, catalogFamilies).id).toBe(it0.design.id);
    const set = setProjectSetting(p, 'plinthHeight', 120).project;
    expect(set.items.map(rotationOf)).toEqual([75, 0]);
    const follow = followProject(set, p.items[0].id, 'plinthHeight');
    expect(follow.items[0].angle).toBe(75);
  });
});

// ADR-211 (N216): Lock boards and Lock construction (G-337), the front-view selection box (G-308), a bed's mattress
// size where the piece is selected (G-126) and the wizard's session draft (G-356).
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { frameDefaults, newId, templates, wrap } from '../src/core/design';
import {
  makeItem,
  newProject,
  placedBounds,
  PROJECT_SCHEMA,
  validateProject,
  type Project,
} from '../src/core/project';
import {
  BOARDS_LOCKED_HINT,
  boardsChanged,
  CONSTRUCTION_KEYS,
  CONSTRUCTION_LOCKED_HINT,
  constructionChanged,
  isBoardsLocked,
  isConstructionLocked,
  lockBlocked,
  pieceLocksBlocked,
  setBoardsLocked,
  setConstructionLocked,
} from '../src/core/pieceLocks';
import { bedSizeFields, resizeBed, sizeFields } from '../src/core/pieceSize';
import { itemsInFrontBox } from '../src/core/selection';
import { hasAnyLock } from '../src/core/sizeLock';
import type { CabinetParams, Design, FrameParams } from '../src/core/types';
import { db, loadProject, saveProject } from '../src/persist/db';
import { useDesign } from '../src/store/designStore';
import { useUi } from '../src/store/uiStore';

const tpl = (id: string) => templates.find((x) => x.id === id)!.create();
function row(...ids: string[]): Project {
  let p = newProject('Locks');
  for (const id of ids) p = { ...p, items: [...p.items, makeItem(p, tpl(id))] };
  return p;
}
const cab = (p: Project, id: string) =>
  p.items.find((i) => i.id === id)!.design.product.params as CabinetParams;
const withCab = (d: Design, patch: Partial<CabinetParams>): Design => ({
  ...d,
  product: {
    ...d.product,
    params: { ...(d.product.params as CabinetParams), ...patch },
  } as Design['product'],
});
const st = () => useDesign.getState();
const frame = (name: string, kind: FrameParams['kind']) =>
  wrap(name, { kind: 'frame', id: newId(), params: frameDefaults(kind) });
const bedDesign = () => frame('Bed', 'bed');

describe('board and construction locks (ADR-211, G-337)', () => {
  it('flags are set and cleared; absent means unlocked; the same project when nothing changes', () => {
    const p0 = row('base-door');
    const id = p0.items[0].id;
    expect(isBoardsLocked(p0.items[0])).toBe(false);
    expect(isConstructionLocked(p0.items[0])).toBe(false);
    const p = setConstructionLocked(setBoardsLocked(p0, id, true), id, true);
    expect(p.items[0].boardsLocked).toBe(true);
    expect(p.items[0].constructionLocked).toBe(true);
    expect(setBoardsLocked(p, id, true)).toBe(p);
    expect(setBoardsLocked(p0, id, false)).toBe(p0);
    const off = setConstructionLocked(setBoardsLocked(p, id, false), id, false);
    expect('boardsLocked' in off.items[0]).toBe(false);
    expect('constructionLocked' in off.items[0]).toBe(false);
  });

  it('lockBlocked refuses a board change on a boards-locked piece with the reason; construction and size pass', () => {
    const p0 = row('base-door');
    const id = p0.items[0].id;
    const d = p0.items[0].design;
    const boards: Design = {
      ...d,
      materials: d.materials.map((m, i) => (i === 0 ? { ...m, name: 'Other board' } : m)),
    };
    const body = withCab(d, { bodyMaterialId: 'pal18oak' });
    const build = withCab(d, { plinthHeight: 150 });
    const wider = withCab(d, { width: (d.product.params as CabinetParams).width + 100 });
    // No lock: nothing is refused.
    for (const next of [boards, body, build, wider]) expect(lockBlocked(p0, id, next)).toBeNull();
    const p = setBoardsLocked(p0, id, true);
    expect(lockBlocked(p, id, boards)).toBe(BOARDS_LOCKED_HINT);
    expect(lockBlocked(p, id, body)).toBe(BOARDS_LOCKED_HINT);
    expect(BOARDS_LOCKED_HINT).toBe('Boards locked — unlock to change');
    expect(lockBlocked(p, id, build)).toBeNull();
    expect(lockBlocked(p, id, wider)).toBeNull();
    expect(lockBlocked(p, id, d)).toBeNull();
    expect(boardsChanged(d, boards)).toBe(true);
    expect(boardsChanged(d, build)).toBe(false);
  });

  it('lockBlocked refuses a construction change on a construction-locked piece; boards and size pass', () => {
    const p0 = row('base-door');
    const id = p0.items[0].id;
    const d = p0.items[0].design;
    const p = setConstructionLocked(p0, id, true);
    for (const key of ['plinthHeight', 'frontGap', 'back', 'top'] as const)
      expect(CONSTRUCTION_KEYS.cabinet).toContain(key);
    expect(lockBlocked(p, id, withCab(d, { plinthHeight: 150 }))).toBe(CONSTRUCTION_LOCKED_HINT);
    expect(CONSTRUCTION_LOCKED_HINT).toBe('Construction locked — unlock to change');
    expect(lockBlocked(p, id, withCab(d, { frontGap: 4 }))).toBe(CONSTRUCTION_LOCKED_HINT);
    expect(lockBlocked(p, id, withCab(d, { bodyMaterialId: 'pal18oak' }))).toBeNull();
    expect(lockBlocked(p, id, withCab(d, { width: 700 }))).toBeNull();
    expect(constructionChanged(d, bedDesign())).toBe(true);
    // A kind without a Construction group has no construction keys.
    expect(CONSTRUCTION_KEYS.panel).toEqual([]);
  });

  it('pieceLocksBlocked checks only the pieces whose design changed', () => {
    const p0 = row('base-door', 'base-door');
    const [a, b] = p0.items.map((i) => i.id);
    const p = setConstructionLocked(setBoardsLocked(p0, a, true), a, true);
    const change = (id: string, patch: Partial<CabinetParams>): Project => ({
      ...p,
      items: p.items.map((i) => (i.id === id ? { ...i, design: withCab(i.design, patch) } : i)),
    });
    expect(pieceLocksBlocked(null, change(a, { plinthHeight: 150 }))).toBeNull();
    expect(pieceLocksBlocked(p, change(a, { plinthHeight: 150 }))).toBe(CONSTRUCTION_LOCKED_HINT);
    expect(pieceLocksBlocked(p, change(a, { frontMaterialId: 'pal18oak' }))).toBe(
      BOARDS_LOCKED_HINT,
    );
    expect(pieceLocksBlocked(p, change(b, { plinthHeight: 150 }))).toBeNull();
    // Moving the locked piece does not change its design.
    const moved: Project = {
      ...p,
      items: p.items.map((i) =>
        i.id === a ? { ...i, position: { ...i.position, x: i.position.x + 500 } } : i,
      ),
    };
    expect(pieceLocksBlocked(p, moved)).toBeNull();
  });

  it('hasAnyLock (snapping) is unchanged: board and construction locks alone are not a lock', () => {
    expect(hasAnyLock({ boardsLocked: true, constructionLocked: true } as never)).toBe(false);
    expect(hasAnyLock({ locked: true })).toBe(true);
  });
});

describe('locks in the store (ADR-211)', () => {
  beforeEach(() => st().openProject(row('base-door', 'base-door')));

  it('Lock boards refuses a board change with the reason; size and place still change', () => {
    const [a, b] = st().project!.items.map((i) => i.id);
    st().setBoardsLocked(a, true);
    expect(st().project!.items[0].boardsLocked).toBe(true);
    st().editItem(a);
    const m = st().design.materials[0];
    st().updateMaterial(m.id, { name: 'Renamed board' });
    expect(st().design.materials[0].name).toBe(m.name);
    expect(st().notice).toBe(BOARDS_LOCKED_HINT);
    st().updateCabinet({ plinthHeight: 140 });
    expect((st().design.product.params as CabinetParams).plinthHeight).toBe(140);
    st().resizePiece('width', 700);
    expect((st().design.product.params as CabinetParams).width).toBe(700);
    st().backToProject();
    expect(cab(st().project!, a).width).toBe(700);
    expect(cab(st().project!, a).plinthHeight).toBe(140);
    st().resizeItem(a, 'height', 900);
    expect(cab(st().project!, a).height).toBe(900);
    const x = st().project!.items[0].position.x;
    st().moveItemBy(a, 100, 0);
    expect(st().project!.items[0].position.x).toBe(x + 100);
    // The unlocked neighbour still takes a board change.
    st().editItem(b);
    st().updateMaterial(st().design.materials[0].id, { name: 'Renamed board' });
    expect(st().design.materials[0].name).toBe('Renamed board');
    st().backToProject();
    st().setBoardsLocked(a, false);
    expect('boardsLocked' in st().project!.items[0]).toBe(false);
  });

  it('Lock construction refuses a construction change, also from a project setting; boards and size change', () => {
    const [a, b] = st().project!.items.map((i) => i.id);
    st().setConstructionLocked(a, true);
    const locked = st().project!;
    expect(locked.items[0].constructionLocked).toBe(true);
    // A project-wide plinth height reaches both pieces: the whole change is refused.
    st().setProjectSetting('plinthHeight', 150);
    expect(st().project).toBe(locked);
    expect(st().notice).toBe(CONSTRUCTION_LOCKED_HINT);
    expect(cab(st().project!, b).plinthHeight).not.toBe(150);
    st().editItem(a);
    const plinth = (st().design.product.params as CabinetParams).plinthHeight;
    st().updateCabinet({ plinthHeight: plinth + 20 });
    expect((st().design.product.params as CabinetParams).plinthHeight).toBe(plinth);
    expect(st().notice).toBe(CONSTRUCTION_LOCKED_HINT);
    st().updateCabinet({ bodyMaterialId: 'pal18oak' });
    expect((st().design.product.params as CabinetParams).bodyMaterialId).toBe('pal18oak');
    st().resizePiece('depth', 500);
    expect((st().design.product.params as CabinetParams).depth).toBe(500);
    st().backToProject();
    expect(cab(st().project!, a).depth).toBe(500);
  });
});

describe('board and construction locks are saved under project schema 21 (ADR-211, ADR-011)', () => {
  beforeEach(async () => {
    await db.projects.clear();
  });

  it('schema 21 validates the flags; schema 20 refuses them; bad values are refused', () => {
    expect(PROJECT_SCHEMA).toBe(21);
    const p0 = row('base-door');
    const id = p0.items[0].id;
    const both = setConstructionLocked(setBoardsLocked(p0, id, true), id, true);
    expect(validateProject(both)).toEqual([]);
    const old = { ...both, schemaVersion: 20 as const };
    expect(validateProject(old)).toContain(
      'Board and construction locks need project schemaVersion 21',
    );
    const bad = (patch: object) =>
      validateProject({ ...p0, items: p0.items.map((i) => ({ ...i, ...patch })) } as Project);
    expect(bad({ boardsLocked: false })).toContain('Invalid item boards lock');
    expect(bad({ constructionLocked: 'yes' })).toContain('Invalid item construction lock');
  });

  it('a schema 20 project loads unchanged, its pieces unlocked; a locked schema 21 project round-trips', async () => {
    const p0 = row('base-door', 'wall-cabinet');
    const old: Project = { ...p0, schemaVersion: 20 as never };
    expect(validateProject(old)).toEqual([]);
    await saveProject(old);
    const loaded = await loadProject(old.id);
    expect(loaded).toEqual(old);
    expect(loaded!.items.every((i) => !isBoardsLocked(i) && !isConstructionLocked(i))).toBe(true);
    // Absent flags: no change is refused.
    const d = loaded!.items[0].design;
    expect(lockBlocked(loaded!, loaded!.items[0].id, withCab(d, { plinthHeight: 150 }))).toBeNull();

    const id = p0.items[0].id;
    const locked = setConstructionLocked(setBoardsLocked(p0, id, true), id, true);
    await saveProject(locked);
    const back = await loadProject(locked.id);
    expect(back!.schemaVersion).toBe(21);
    expect(back!.items[0].boardsLocked).toBe(true);
    expect(back!.items[0].constructionLocked).toBe(true);
  });
});

describe('itemsInFrontBox (ADR-211, G-308)', () => {
  it('returns the pieces whose x and y extent touches the rectangle, in project order, any corner order', () => {
    const p = row('base-door', 'base-door', 'base-door');
    const [a, b, c] = p.items.map((i) => i.id);
    const [fa, fb, fc] = p.items.map(placedBounds);
    expect(fb.x).toBeGreaterThanOrEqual(fa.x + fa.w);
    // A box across the middle of the first two pieces, at mid height.
    const y = Math.round(fa.y + fa.h / 2);
    expect(itemsInFrontBox(p, { x: fa.x + 10, y }, { x: fb.x + 10, y: y + 10 })).toEqual([a, b]);
    // Corners in either order.
    expect(itemsInFrontBox(p, { x: fb.x + 10, y: y + 10 }, { x: fa.x + 10, y })).toEqual([a, b]);
    // Touching the edge counts.
    expect(itemsInFrontBox(p, { x: fc.x, y }, { x: fc.x + fc.w + 500, y })).toContain(c);
    // Above every piece: none.
    const top = Math.max(fa.y + fa.h, fb.y + fb.h, fc.y + fc.h);
    expect(itemsInFrontBox(p, { x: fa.x, y: top + 10 }, { x: fc.x + fc.w, y: top + 500 })).toEqual(
      [],
    );
  });

  it('uses the placed boxes it is given and skips pieces without one', () => {
    const p = row('base-door', 'base-door');
    const [a, b] = p.items.map((i) => i.id);
    const placed = new Map([
      [a, { x: 0, y: 0, z: 0, w: 100, h: 100, d: 100 }],
      [b, { x: 0, y: 1000, z: 0, w: 100, h: 100, d: 100 }],
    ]);
    expect(itemsInFrontBox(p, { x: 50, y: 50 }, { x: 60, y: 60 }, placed)).toEqual([a]);
    expect(itemsInFrontBox(p, { x: 50, y: 50 }, { x: 60, y: 1050 }, placed)).toEqual([a, b]);
    expect(
      itemsInFrontBox(p, { x: 50, y: 50 }, { x: 60, y: 60 }, new Map([[b, placed.get(b)!]])),
    ).toEqual([]);
  });
});

describe('bed mattress size (ADR-211, G-126)', () => {
  it('bedSizeFields gives the mattress width and length with their limits; other pieces none', () => {
    const bed = bedDesign().product;
    expect(bedSizeFields(bed)).toEqual([
      { key: 'width', label: 'Mattress width', value: 1600, min: 300, max: 2200 },
      { key: 'depth', label: 'Mattress length', value: 2000, min: 600, max: 2300 },
    ]);
    expect(bedSizeFields(tpl('base-door').product)).toEqual([]);
    expect(bedSizeFields(frame('Table', 'table').product)).toEqual([]);
    // The outside size fields stay the outside size (groups, repairs, variables).
    expect(sizeFields(bed).map((f) => f.label)).not.toContain('Mattress width');
  });

  it('resizeBed changes the mattress width or length only; anything else comes back the same', () => {
    const bed = bedDesign().product;
    const wide = resizeBed(bed, 'width', 1400);
    expect((wide.params as FrameParams).bed!.mattress).toEqual({ w: 1400, l: 2000 });
    const long = resizeBed(bed, 'depth', 2100);
    expect((long.params as FrameParams).bed!.mattress).toEqual({ w: 1600, l: 2100 });
    expect(resizeBed(bed, 'height', 900)).toBe(bed);
    expect(resizeBed(bed, 'width', 1600)).toBe(bed);
    const box = tpl('base-door').product;
    expect(resizeBed(box, 'width', 700)).toBe(box);
  });

  it('a width lock turns off the mattress width (the matching key); resizing a project bed sets the mattress', () => {
    let p = newProject('Beds');
    p = { ...p, items: [makeItem(p, bedDesign())] };
    st().openProject(p);
    const id = st().project!.items[0].id;
    st().resizeItem(id, 'width', 1400);
    const m = () => (st().project!.items[0].design.product.params as FrameParams).bed!.mattress;
    expect(m()).toEqual({ w: 1400, l: 2000 });
    st().setAxisLocked(id, 'width', true);
    const before = st().project!;
    st().resizeItem(id, 'width', 1200);
    expect(st().project).toBe(before);
    expect(st().notice).toMatch(/width locked/i);
    st().resizeItem(id, 'depth', 2100);
    expect(m()).toEqual({ w: 1400, l: 2100 });
    // PieceSize turns off the field whose key is locked: the mattress width is the width key.
    expect(bedSizeFields(st().project!.items[0].design.product).map((f) => f.key)).toEqual([
      'width',
      'depth',
    ]);
  });
});

describe('wizard draft (ADR-211, G-356)', () => {
  it('lives in the UI store only: none at start, set and cleared', () => {
    expect(useUi.getState().wizardDraft).toBeNull();
    const draft = { answers: {} as never, stepId: 'size', done: ['type'] };
    useUi.getState().setWizardDraft(draft);
    expect(useUi.getState().wizardDraft).toBe(draft);
    useUi.getState().setWizardDraft(null);
    expect(useUi.getState().wizardDraft).toBeNull();
  });
});

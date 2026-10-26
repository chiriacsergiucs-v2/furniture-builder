import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { findInProduct, splitSpace, templates } from '../src/core/design';
import { makeItem, newProject, pieceBoxToRoom, placeItem, type Project } from '../src/core/project';
import { countSubject } from '../src/core/counts';
import { drill, hitToMm, inSelection, pathAt, selectionBox } from '../src/core/selectPath';
import type { Design, Space, SpaceOpening } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

/** A sideboard: 2 vertical dividers (3 bays), the middle bay divided by a horizontal divider, 2 shelves below it. */
function piece(): { design: Design; left: string; middle: string; top: string; bottom: string } {
  const d = templates.find((t) => t.id === 'sideboard')!.create();
  if (d.product.kind !== 'cabinet') throw new Error('cabinet expected');
  const root = d.product.params.interior as Extract<Space, { kind: 'split' }>;
  const halves = splitSpace(root.children[1], 'y', 2) as Extract<Space, { kind: 'split' }>;
  // The bottom part holds 2 shelves (a new part starts empty, ADR-089); the project tap test aims at one.
  const middle = {
    ...halves,
    children: [halves.children[0], { ...halves.children[1], kind: 'shelves', count: 2 } as Space],
  };
  const interior = { ...root, children: [root.children[0], middle, root.children[2]] };
  const design = { ...d, product: { ...d.product, params: { ...d.product.params, interior } } };
  return {
    design,
    left: root.children[0].id,
    middle: middle.id,
    top: middle.children[0].id,
    bottom: middle.children[1].id,
  };
}

const centre = (o: SpaceOpening) => [o.box.x + o.box.w / 2, o.box.y + o.box.h / 2] as const;
const opening = (d: Design, id: string) => buildModel(d).spaces.find((s) => s.nodeId === id)!;

describe('outside-in selection (ADR-083)', () => {
  const p = piece();
  const model = buildModel(p.design);
  const [bx, by] = centre(opening(p.design, p.bottom));

  it('the path under a point skips the lone divided interior', () => {
    expect(pathAt(model, bx, by)).toEqual([p.middle, p.bottom]);
  });

  it('taps at one point: whole piece → middle bay → bottom space → whole piece again', () => {
    const seq = [];
    let sel = drill(model, bx, by, undefined);
    for (let i = 0; i < 4; i++) {
      seq.push(sel);
      sel = drill(model, bx, by, sel);
    }
    expect(seq).toEqual([null, p.middle, p.bottom, null]);
  });

  it('with the middle bay selected, a tap in the left bay selects the left bay', () => {
    const [lx, ly] = centre(opening(p.design, p.left));
    expect(drill(model, lx, ly, p.middle)).toBe(p.left);
    // From deep inside the middle bay too: where the paths part, one level down.
    expect(drill(model, lx, ly, p.bottom)).toBe(p.left);
    // The sibling space inside the same bay.
    const [tx, ty] = centre(opening(p.design, p.top));
    expect(drill(model, tx, ty, p.bottom)).toBe(p.top);
  });

  it('nothing selected selects the whole piece; a point outside the piece selects nothing', () => {
    expect(drill(model, bx, by, undefined)).toBeNull();
    const b = model.bounds;
    expect(drill(model, b.x + b.w + 50, by, p.middle)).toBeUndefined();
  });

  it('3D hits in metres map to the same mm; exploded views use the built panel centre', () => {
    expect(hitToMm({ x: bx / 1000, y: by / 1000, z: 0.3 }, undefined, false)).toEqual({
      x: Math.round(bx),
      y: Math.round(by),
      z: 300,
    });
    const shelf = model.panels.find((q) => q.nodeId === p.left && q.role === 'shelf')!;
    const at = hitToMm({ x: 99, y: 99, z: 99 }, shelf, true);
    expect(pathAt(model, at.x, at.y)).toEqual([p.left]);
  });
});

describe('store: tapping the piece (ADR-083)', () => {
  beforeEach(() => useDesign.getState().closeProject());

  it('loading leaves nothing selected; taps drill; undo and redo keep a valid selection', () => {
    const p = piece();
    const st = useDesign.getState;
    st().load(p.design);
    expect(st().selectedId).toBeUndefined();
    const [bx, by] = centre(opening(p.design, p.bottom));
    st().tapPiece(bx, by);
    expect(st().selectedId).toBeNull();
    st().tapPiece(bx, by);
    st().tapPiece(bx, by);
    expect(st().selectedId).toBe(p.bottom);
    // Divide the bottom space, select a new child, undo: the child is gone, the whole piece stays selected.
    st().updateSpace(p.bottom, (s) => splitSpace(s, 'x', 2));
    const child = (st().model.spaces.find((s) => s.depth === 3) as SpaceOpening).nodeId;
    st().select(child);
    st().undo();
    expect(st().selectedId).toBeNull();
    st().redo();
    expect(st().selectedId).toBeNull();
  });
});

describe('store: tapping a project piece (ADR-083, ADR-088)', () => {
  const st = useDesign.getState;
  function open(rotationY: 0 | 90): { project: Project; p: ReturnType<typeof piece>; id: string } {
    const p = piece();
    const pr = newProject();
    const item = { ...makeItem(pr, p.design), rotationY };
    const project = { ...pr, items: [item] };
    st().openProject(project);
    return { project, p, id: item.id };
  }
  /** A shelf of the bottom space, in room mm: its centre is the tap point. */
  function shelfPoint(project: Project, p: ReturnType<typeof piece>) {
    const placed = placeItem(project.items[0]);
    const local = buildModel(p.design).panels.findIndex(
      (q) => q.nodeId === p.bottom && q.role === 'shelf',
    );
    const b = placed.panels[local].box;
    return { x: b.x + b.w / 2, y: b.y + b.h / 2, z: b.z + b.d / 2 };
  }
  const shelves = (id: string, space: string) => {
    const item = st().project!.items.find((i) => i.id === id)!;
    const s = findInProduct(item.design.product, space)?.space;
    return s?.kind === 'shelves' ? s.count : undefined;
  };

  for (const r of [0, 90] as const)
    it(`taps drill into the piece and the project editor stays open (turned ${r}°)`, () => {
      const { project, p, id } = open(r);
      const at = shelfPoint(project, p);
      st().tapItem(id, at);
      expect([st().selectedItemId, st().drillItemId, st().selectedId]).toEqual([id, id, null]);
      st().tapItem(id, at);
      expect(st().editingItemId).toBeNull();
      expect(st().selectedId).toBe(p.middle);
      st().tapItem(id, at);
      expect(st().selectedId).toBe(p.bottom);
      // The innermost level wraps back to the whole piece (G-051).
      st().tapItem(id, at);
      expect(st().selectedId).toBeNull();
      expect(st().editingItemId).toBeNull();
    });

  it('a 2nd tap with no point (the plan) selects the interior and stays in the project', () => {
    const { p, id } = open(0);
    st().tapItem(id);
    st().tapItem(id);
    expect(st().editingItemId).toBeNull();
    const d = p.design.product;
    expect(st().selectedId).toBe(d.kind === 'cabinet' ? d.params.interior.id : undefined);
  });

  it('shelves + on a space changes only that piece in the project; one project undo restores it', () => {
    const { project, p, id } = open(0);
    const at = shelfPoint(project, p);
    for (let i = 0; i < 3; i++) st().tapItem(id, at);
    expect(st().selectedId).toBe(p.bottom);
    const before = shelves(id, p.bottom)!;
    st().stepCount('shelves', 1);
    expect(shelves(id, p.bottom)).toBe(before + 1);
    expect(st().editingItemId).toBeNull();
    // The project model follows at once (the 3D view and the parts list read it).
    const shelfPanels = () =>
      st().projectModel!.model.panels.filter((q) => q.nodeId === `${id}:${p.bottom}`).length;
    expect(shelfPanels()).toBe(before + 1);
    st().undoProject();
    expect(shelves(id, p.bottom)).toBe(before);
    expect(shelfPanels()).toBe(before);
    // The loaded piece follows the undo; the selection is kept.
    expect(st().selectedId).toBe(p.bottom);
    const own = findInProduct(st().design.product, p.bottom)?.space;
    expect(own?.kind === 'shelves' ? own.count : undefined).toBe(before);
    st().redoProject();
    expect(shelves(id, p.bottom)).toBe(before + 1);
  });

  it('selecting another piece, removing the piece or opening another project leaves a valid selection', () => {
    const { project, p, id } = open(0);
    const at = shelfPoint(project, p);
    st().tapItem(id, at);
    st().tapItem(id, at);
    st().selectItem(null);
    expect([st().drillItemId, st().selectedItemId]).toEqual([null, null]);
    st().tapItem(id, at);
    st().removeItem(id);
    expect(st().drillItemId).toBeNull();
    st().undoProject();
    expect(st().project!.items).toHaveLength(1);
    st().openProject(newProject());
    expect([st().drillItemId, st().selectedItemId]).toEqual([null, null]);
  });

  for (const r of [0, 90, 180, 270] as const)
    it(`a selected space is placed in the room like its panels (turned ${r}°)`, () => {
      const p = piece();
      const pr = newProject();
      const item = { ...makeItem(pr, p.design), rotationY: r };
      const built = buildModel(p.design);
      const box = pieceBoxToRoom(item, built, opening(p.design, p.bottom).box);
      const shelvesIn = placeItem(item).panels.filter((q) => q.nodeId === `${item.id}:${p.bottom}`);
      expect(shelvesIn.length).toBeGreaterThan(0);
      for (const q of shelvesIn) {
        const b = q.box;
        expect(b.x >= box.x && b.x + b.w <= box.x + box.w).toBe(true);
        expect(b.y >= box.y && b.y + b.h <= box.y + box.h).toBe(true);
        expect(b.z >= box.z && b.z + b.d <= box.z + box.d).toBe(true);
      }
    });

  it('"Edit this piece" still opens the piece editor', () => {
    const { id } = open(0);
    st().tapItem(id);
    st().editItem(id);
    expect([st().editingItemId, st().drillItemId]).toEqual([id, null]);
  });
});

describe('the selection look follows the selection (ADR-087)', () => {
  const st = useDesign.getState;
  beforeEach(() => st().load(piece().design));

  it("the user's steps: piece, bay, tap again → the whole piece is outlined and the card acts on it", () => {
    const p = piece();
    st().load(p.design);
    const [x, y] = centre(opening(p.design, p.left));
    st().tapPiece(x, y);
    st().tapPiece(x, y);
    expect(st().selectedId).toBe(p.left);
    expect(selectionBox(st().model, st().selectedId)).toEqual(opening(p.design, p.left).box);
    st().tapPiece(x, y);
    expect(st().selectedId).toBeNull();
    const model = st().model;
    expect(selectionBox(model, st().selectedId)).toEqual(model.bounds);
    // The card acts on the piece's interior, and nothing is faded: every panel is inside the outline.
    const product = st().design.product;
    expect(countSubject(product, st().selectedId)).toBe(
      product.kind === 'cabinet' ? product.params.interior.id : undefined,
    );
    expect(model.panels.every((q) => inSelection(model.bounds, q.box))).toBe(true);
  });

  it('a bay keeps its own shelves and fronts; a divided space keeps its divider and children', () => {
    const p = piece();
    const model = buildModel(p.design);
    const inBox = (id: string) =>
      new Set(
        model.panels
          .filter((q) => inSelection(selectionBox(model, id)!, q.box))
          .map((q) => q.nodeId),
      );
    const left = inBox(p.left);
    expect(left.has(p.left)).toBe(true);
    expect(left.has(p.middle)).toBe(false);
    expect(left.has(p.bottom)).toBe(false);
    const middle = inBox(p.middle);
    expect([p.middle, p.bottom].every((id) => middle.has(id))).toBe(true);
    expect(middle.has(p.left)).toBe(false);
    // Carcass sides, top and bottom sit outside any bay.
    const sides = model.panels.filter((q) => q.role === 'side');
    expect(sides.some((q) => inSelection(selectionBox(model, p.left)!, q.box))).toBe(false);
    expect(selectionBox(model, undefined)).toBeUndefined();
  });
});

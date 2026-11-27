// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { templates } from '../src/core/design';
import { makeItem, newProject, placeItem, tapPosition } from '../src/core/project';
import { dropNewPiece } from '../src/core/snap';
import { useDesign } from '../src/store/designStore';
import { registerViewHit, usePieceList } from '../src/store/pieceListStore';
import { dragSource, endPieceDrag } from '../src/ui/pieceDrag';
import { catalogDropPoint } from '../src/viewer/catalogDrop';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const st = () => useDesign.getState();
const rect = { left: 100, top: 50, width: 800, height: 600 };

/** A camera in metres (the scene's scale) at `pos`, looking at `at`. */
function cam(pos: [number, number, number], at: [number, number, number]) {
  const c = new PerspectiveCamera(32, rect.width / rect.height, 0.01, 100);
  c.position.set(...pos);
  c.lookAt(...at);
  c.updateMatrixWorld();
  c.updateProjectionMatrix();
  return c;
}

describe('dropping a catalog item on the 3D view: screen point to floor point (ADR-303)', () => {
  it('the canvas centre lands on the floor point the camera looks at, in room mm', () => {
    const c = cam([3, 2.5, 4], [1.2, 0, 0.8]);
    const p = catalogDropPoint(c, rect, rect.left + rect.width / 2, rect.top + rect.height / 2)!;
    expect(p.x).toBeCloseTo(1200, 3);
    expect(p.z).toBeCloseTo(800, 3);
  });

  it('a point lower on the screen lands nearer the camera, one to the right lands to the right', () => {
    const c = cam([1, 2, 4], [1, 0, 1]);
    const mid = catalogDropPoint(c, rect, 500, 350)!;
    const low = catalogDropPoint(c, rect, 500, 500)!;
    const right = catalogDropPoint(c, rect, 700, 350)!;
    expect(low.z).toBeGreaterThan(mid.z);
    expect(right.x).toBeGreaterThan(mid.x);
  });

  it('outside the canvas, above the horizon or with an empty canvas there is no point', () => {
    const c = cam([1, 2, 4], [1, 0, 1]);
    expect(catalogDropPoint(c, rect, 99, 350)).toBeNull();
    expect(catalogDropPoint(c, rect, 500, 651)).toBeNull();
    expect(catalogDropPoint(c, { ...rect, width: 0 }, 500, 350)).toBeNull();
    // Looking level: the top half of the screen is sky.
    const level = cam([1, 1.2, 4], [1, 1.2, 0]);
    expect(catalogDropPoint(level, rect, 500, 60)).toBeNull();
  });

  it('the floor point gives the same piece and position as a release on the plan there', () => {
    st().openProject(newProject('3D drop'));
    const c = cam([3, 2.5, 4], [1.2, 0, 0.8]);
    const p = catalogDropPoint(c, rect, 480, 400)!;
    const { project, projectModel } = st();
    const me = placeItem(makeItem(project!, t('base-door')));
    const r = dropNewPiece(project!, projectModel!.pieces, me, p, false);
    expect(r.position).toEqual(tapPosition(me.item, p.x, p.z));
    expect(Number.isInteger(r.position.x) && Number.isInteger(r.position.z)).toBe(true);
  });
});

describe('the piece list drag drops on the 3D view when the pointer is over it (ADR-303)', () => {
  const ptr = (type: string, x: number, y: number, extra: Record<string, unknown> = {}) => {
    const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, ...extra });
    Object.defineProperty(e, 'pointerId', { value: 1 });
    window.dispatchEvent(e);
  };
  const press = (make: () => { design: ReturnType<typeof t> }) =>
    dragSource(make).onPointerDown({
      pointerType: 'mouse',
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 10,
      preventDefault: () => {},
      currentTarget: { focus: () => {} },
    } as never);

  beforeEach(() => {
    st().openProject(newProject('3D drop'));
    // The 3D view under (500..900, 300..600) maps a screen point to a room point.
    registerViewHit((x, y) =>
      x >= 500 && y >= 300 ? { x: (x - 500) * 5, z: (y - 300) * 2 } : null,
    );
  });
  afterEach(() => {
    registerViewHit(null);
    endPieceDrag();
  });

  it('a release over the 3D view adds the piece at its floor point, one undo step', () => {
    const before = st().project!.items.length;
    press(() => ({ design: t('base-door') }));
    ptr('pointermove', 600, 400);
    expect(usePieceList.getState().drag?.room).toEqual({ x: 500, z: 200 });
    ptr('pointerup', 600, 400);
    const items = st().project!.items;
    expect(items.length).toBe(before + 1);
    // Snap is on by default and the room is empty: the piece lands where it was dropped.
    expect(items.at(-1)!.position).toMatchObject({ x: 500, z: 200 });
    st().undoProject();
    expect(st().project!.items.length).toBe(before);
  });

  it('a release off both the plan and the 3D view adds nothing', () => {
    const before = st().project!.items.length;
    press(() => ({ design: t('base-door') }));
    ptr('pointermove', 600, 400);
    ptr('pointermove', 200, 100);
    expect(usePieceList.getState().drag?.room).toBeNull();
    ptr('pointerup', 200, 100);
    expect(st().project!.items.length).toBe(before);
  });
});

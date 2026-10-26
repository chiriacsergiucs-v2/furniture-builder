import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import { makeItem, newProject, placeItem, type ProjectItem } from '../src/core/project';
import { dropNewPiece } from '../src/core/snap';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const st = () => useDesign.getState();
/** An item without its fresh id, to compare two placements of the same design. */
const strip = ({ id: _id, ...rest }: ProjectItem) => (void _id, rest);

/** Drop `tpl` at a room point as the piece list does: the built piece, `dropNewPiece`, then `addPieceAt`. */
function drop(tpl: string | ReturnType<typeof t>, x: number, z: number, snap: boolean) {
  const { project, projectModel } = st();
  const d = typeof tpl === 'string' ? t(tpl) : tpl;
  const me = placeItem(makeItem(project!, d));
  const r = dropNewPiece(project!, projectModel!.pieces, me, { x, z }, snap);
  st().addPieceAt(d, r.position.x, r.position.z);
  return r;
}

describe('dropping a catalog item from the piece list onto the plan (ADR-094)', () => {
  beforeEach(() => {
    st().openProject(newProject('Drop'));
    st().addPiece(t('base-door'));
    st().stopPlacing();
  });

  it('gives the same piece and position as tap-to-place at that room point', () => {
    for (const [tpl, x, z] of [
      ['base-door', 1234.4, 456.6],
      ['base-door', -50, -10],
      ['wall-cabinet', 2500, 300],
    ] as const) {
      const p0 = st().project!;
      // Tap-to-place (ADR-056): add, then tap the plan.
      const d = t(tpl);
      st().addPiece(d);
      st().placeAt(x, z);
      const tapped = st().project!.items.at(-1)!;
      // Back to the same project, then drop at the same point with Snap off.
      st().openProject(p0);
      drop(d, x, z, false);
      const dropped = st().project!.items.at(-1)!;
      expect(strip(dropped)).toEqual(strip(tapped));
      expect(Number.isInteger(dropped.position.x) && Number.isInteger(dropped.position.z)).toBe(
        true,
      );
      st().openProject(p0);
    }
  });

  it('the outline is the built footprint with its left-back corner at the point', () => {
    const { project, projectModel } = st();
    const me = placeItem(makeItem(project!, t('base-door')));
    const r = dropNewPiece(project!, projectModel!.pieces, me, { x: 3000.2, z: 800 }, false);
    expect(r.position).toMatchObject({ x: 3000, z: 800 });
    expect(r.box).toMatchObject({ w: me.bounds.w, d: me.bounds.d, h: me.bounds.h });
    const placed = placeItem({ ...me.item, position: r.position }).bounds;
    expect(r.box).toEqual(placed);
  });

  it('snaps as a dragged piece does (ADR-070): beside a neighbour and against the back wall', () => {
    const first = st().projectModel!.pieces[0].bounds;
    const r = drop('base-door', first.x + first.w + 35, 25, true);
    expect(r.snap).not.toBeNull();
    expect(r.position.x).toBe(first.x + first.w);
    expect(r.position.z).toBe(0);
    const added = st().projectModel!.pieces.at(-1)!.bounds;
    expect(added.x).toBe(first.x + first.w);
  });

  it('is one undo step, and selects the new piece without a tap mode', () => {
    const p0 = st().project!;
    drop('base-door', 1500, 0, false);
    expect(st().project!.items).toHaveLength(2);
    expect(st().placingItemId).toBeNull();
    expect(st().selectedItemId).toBe(st().project!.items[1].id);
    st().undoProject();
    expect(st().project).toBe(p0);
  });
});

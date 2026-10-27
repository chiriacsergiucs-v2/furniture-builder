import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { frameDefaults, templates } from '../src/core/design';
import { resizeProduct, sizeFields } from '../src/core/pieceSize';
import { makeItem, newProject } from '../src/core/project';
import type { Design, Product } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

const byTemplate = (id: string) => templates.find((t) => t.id === id)!.create();
const st = () => useDesign.getState();
const params = (p: Product) => p.params as unknown as Record<string, unknown>;

describe('width and depth of the whole piece (ADR-106)', () => {
  it('a cabinet, a desk and a corner unit offer width and depth with their Settings limits', () => {
    expect(sizeFields(byTemplate('chest').product).map((f) => [f.key, f.min, f.max])).toEqual([
      ['width', 100, 4000],
      ['depth', 100, 1200],
    ]);
    expect(sizeFields(byTemplate('desk-pedestal').product).map((f) => f.key)).toEqual([
      'width',
      'depth',
    ]);
    expect(sizeFields(byTemplate('corner-l').product).map((f) => f.label)).toEqual([
      'Back wing',
      'Depth',
    ]);
  });
  it('a bed and a set of loose panels have no fields; the size is left as it was', () => {
    const bed: Product = { kind: 'frame', id: 'b', params: frameDefaults('bed') };
    expect(sizeFields(bed)).toEqual([]);
    expect(resizeProduct(bed, 'width', 1000)).toBe(bed);
    expect(sizeFields(byTemplate('panels').product)).toEqual([]);
  });
  it('resizing changes only that size', () => {
    const p = byTemplate('chest').product;
    const next = resizeProduct(p, 'depth', 450);
    expect(params(next).depth).toBe(450);
    expect(params(next).width).toBe(params(p).width);
  });
  it('the open piece is resized in one undo step', () => {
    st().load(byTemplate('chest'));
    st().select(null);
    st().resizePiece('width', 1234);
    expect(params(st().design.product).width).toBe(1234);
    expect(st().model.bounds.w).toBe(1234);
    st().undo();
    expect(params(st().design.product).width).not.toBe(1234);
  });
  it('a project piece from the catalog is resized from its card; the saved piece is not touched', () => {
    const d: Design = byTemplate('base-door');
    const p = newProject();
    const item = makeItem(p, d);
    st().openProject({ ...p, items: [item] });
    st().resizeItem(item.id, 'depth', 420);
    const after = st().project!.items[0];
    expect(params(after.design.product).depth).toBe(420);
    expect(params(d.product).depth).not.toBe(420);
    expect(st().projectModel!.pieces[0].bounds.d).toBeGreaterThanOrEqual(420);
  });
});

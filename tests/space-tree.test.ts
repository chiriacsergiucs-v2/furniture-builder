import { describe, expect, it } from 'vitest';
import { cabinet, deskDefaults, newId, splitSpace, wrap } from '../src/core/design';
import { ancestorIds, structureRows } from '../src/core/spaceTree';
import type { Space } from '../src/core/types';

const empty = (id: string): Space => ({ id, kind: 'empty' }) as Space;
const nested = (): Space => {
  const root = splitSpace(empty('r'), 'x', 2);
  const left = root.kind === 'split' ? root.children[0] : empty('x');
  const inner = splitSpace(left, 'y', 2);
  return root.kind === 'split' ? { ...root, children: [inner, root.children[1]] } : root;
};

describe('structureRows (ADR-268)', () => {
  it('lists the whole piece first, then the root, hiding the children of a closed split', () => {
    const d = cabinet('c', {}, nested());
    const rows = structureRows(d.product, new Set());
    expect(rows.map((r) => r.id)).toEqual([null, 'r']);
    expect(rows[0]).toMatchObject({ label: 'Whole cabinet', depth: 1, kind: 'piece' });
    expect(rows[1]).toMatchObject({ label: 'Interior', depth: 2, hasChildren: true, open: false });
  });

  it('lists the spaces depth first once their splits are expanded', () => {
    const interior = nested();
    const d = cabinet('c', {}, interior);
    const kids = interior.kind === 'split' ? interior.children : [];
    const innerKids = kids[0].kind === 'split' ? kids[0].children : [];
    const rows = structureRows(d.product, new Set(['r', kids[0].id]));
    expect(rows.map((r) => r.id)).toEqual([
      null,
      'r',
      kids[0].id,
      innerKids[0].id,
      innerKids[1].id,
      kids[1].id,
    ]);
    expect(rows.map((r) => r.depth)).toEqual([1, 2, 3, 4, 4, 3]);
    expect(rows[2].label).toBe('Left: Divided');
    expect(rows[3].label).toBe('Top: Empty');
    expect(rows[5].label).toBe('Right: Empty');
    expect(rows[2].open).toBe(true);
  });

  it('lists every root of a desk', () => {
    const d = wrap('desk', {
      kind: 'desk',
      id: newId(),
      params: { ...deskDefaults(), support: 'two-pedestals' },
    });
    const rows = structureRows(d.product, new Set());
    expect(rows.map((r) => r.label)).toEqual([
      'Whole desk',
      'Left drawer unit',
      'Right drawer unit',
    ]);
  });

  it('has only the whole piece for a product without spaces', () => {
    const d = wrap('p', {
      kind: 'desk',
      id: newId(),
      params: { ...deskDefaults(), support: 'gables' },
    });
    const rows = structureRows(d.product, new Set());
    expect(rows).toHaveLength(1);
    expect(rows[0].hasChildren).toBe(false);
  });

  it('gives the splits around a space, outermost first', () => {
    const interior = nested();
    const d = cabinet('c', {}, interior);
    const kids = interior.kind === 'split' ? interior.children : [];
    const inner = kids[0].kind === 'split' ? kids[0].children[1].id : '';
    expect(ancestorIds(d.product, inner)).toEqual(['r', kids[0].id]);
    expect(ancestorIds(d.product, 'r')).toEqual([]);
  });
});

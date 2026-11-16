import { parentOf, productRoots } from './design';
import { WHOLE_LABEL, spaceName } from './spaceNames';
import { tr } from './i18n';
import type { Product, SpaceKind } from './types';

/** One row of the structure tree (ADR-268). `id` is `null` for the whole piece. */
interface StructureRow {
  id: string | null;
  /** 1 for the whole piece, 2 for a product root, one more per level inside. */
  depth: number;
  /** The name from ADR-267: the root label, or the place and kind ("Left: Drawers"). */
  label: string;
  kind: SpaceKind | 'piece';
  hasChildren: boolean;
  /** Children are listed under this row. */
  open: boolean;
}

/**
 * The rows of the structure tree, in reading order: the whole piece, then each product root's spaces depth first.
 * Children show only under an expanded split. A projection of the design, never separate state (ADR-004).
 */
export function structureRows(prod: Product, expanded: ReadonlySet<string>): StructureRow[] {
  const rows: StructureRow[] = [
    {
      id: null,
      depth: 1,
      label: WHOLE_LABEL[prod.kind],
      kind: 'piece',
      hasChildren: false,
      open: true,
    },
  ];
  for (const r of productRoots(prod)) {
    const walk = (s: (typeof r)['root'], depth: number) => {
      const hasChildren = s.kind === 'split' && s.children.length > 0;
      const open = hasChildren && expanded.has(s.id);
      rows.push({
        id: s.id,
        depth,
        label: s === r.root ? tr(r.label) : spaceName(r.root, s),
        kind: s.kind,
        hasChildren,
        open,
      });
      if (open && s.kind === 'split') for (const c of s.children) walk(c, depth + 1);
    };
    walk(r.root, 2);
  }
  rows[0].hasChildren = rows.length > 1;
  return rows;
}

/** The ids of the splits around a space, outermost first, for expanding the tree down to it. */
export function ancestorIds(prod: Product, id: string): string[] {
  for (const r of productRoots(prod)) {
    const chain: string[] = [];
    for (let p = parentOf(r.root, id); p; p = parentOf(r.root, p.id)) chain.unshift(p.id);
    if (chain.length || r.root.id === id) return chain;
  }
  return [];
}

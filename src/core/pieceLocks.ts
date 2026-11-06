/**
 * Lock boards and Lock construction (ADR-211, G-337, user "Separate locks per parameter"): a project piece keeps its
 * boards and edge bands, or its construction choices, until unlocked. Its size and place still change (other locks).
 * Checked wherever the size locks are (`resizeBlocked`, `sizeLockBlocked`). Pure.
 */
import { t } from './i18n';
import type { Project, ProjectItem } from './project';
import type { Design, Product } from './types';

export const BOARDS_LOCKED_HINT = t('Boards locked — unlock to change');
export const CONSTRUCTION_LOCKED_HINT = t('Construction locked — unlock to change');

export const isBoardsLocked = (item: Pick<ProjectItem, 'boardsLocked'> | undefined): boolean =>
  !!item?.boardsLocked;
export const isConstructionLocked = (
  item: Pick<ProjectItem, 'constructionLocked'> | undefined,
): boolean => !!item?.constructionLocked;

/**
 * The params each kind's Construction group (`g-build`) edits. Their order and spelling follow the editors
 * (`Inspector.tsx`, `Editors.tsx`); a kind without that group has none.
 */
export const CONSTRUCTION_KEYS: Record<Product['kind'], readonly string[]> = {
  cabinet: [
    'top',
    'topKind',
    'topLayers',
    'railDepth',
    'bottom',
    'back',
    'backInset',
    'plinthHeight',
    'plinthSetback',
    'frontStyle',
    'frontGap',
    'shelfSetback',
    'shelfClearance',
    'pinRowSetback',
  ],
  corner: ['top', 'topLayers', 'back', 'plinthHeight', 'frontGap'],
  desk: ['frontOverhang', 'modesty'],
  frame: ['leg', 'legInset', 'apron', 'stretchers', 'stretcherHeight', 'shelf'],
  panel: [],
  panels: [],
};

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);
const params = (p: Product) => p.params as unknown as Record<string, unknown>;

/** The product's board choices: every `*MaterialId` param, the drawers' boards and the loose panels' boards. */
function productBoards(p: Product): unknown[] {
  const ps = params(p);
  const out: unknown[] = [];
  for (const k of Object.keys(ps).sort())
    if (k.endsWith('MaterialId') || k === 'materialId') out.push(k, ps[k]);
  const drawers = ps.drawers as Record<string, unknown> | undefined;
  if (drawers) out.push(drawers.boxMaterialId, drawers.bottomMaterialId);
  const panels = ps.panels as { materialId?: unknown }[] | undefined;
  if (Array.isArray(panels)) out.push(panels.map((x) => x.materialId));
  return out;
}

/** Whether `next` changes the boards of `prev`: its materials, parts' and roles' boards and bands, or product boards. */
export function boardsChanged(prev: Design, next: Design): boolean {
  if (prev === next) return false;
  return (
    !same(prev.materials, next.materials) ||
    !same(prev.partMaterials, next.partMaterials) ||
    !same(prev.roleMaterials, next.roleMaterials) ||
    !same(prev.roleBands, next.roleBands) ||
    !same(prev.partBands, next.partBands) ||
    !same(productBoards(prev.product), productBoards(next.product))
  );
}

/** Whether `next` changes the construction of `prev` (the `CONSTRUCTION_KEYS` of its kind, or the kind itself). */
export function constructionChanged(prev: Design, next: Design): boolean {
  if (prev === next) return false;
  if (prev.product.kind !== next.product.kind) return true;
  const a = params(prev.product),
    b = params(next.product);
  return CONSTRUCTION_KEYS[prev.product.kind].some((k) => !same(a[k], b[k]));
}

/** Why piece `id` may not take `next` as its design because of its board or construction lock, or null. */
export function lockBlocked(project: Project, id: string, next: Design): string | null {
  const it = project.items.find((i) => i.id === id);
  if (!it || it.design === next) return null;
  if (isBoardsLocked(it) && boardsChanged(it.design, next)) return BOARDS_LOCKED_HINT;
  if (isConstructionLocked(it) && constructionChanged(it.design, next))
    return CONSTRUCTION_LOCKED_HINT;
  return null;
}

/** Why the change from `before` to `after` is refused by a board or construction lock (only changed pieces), or null. */
export function pieceLocksBlocked(before: Project | null, after: Project): string | null {
  if (!before) return null;
  const was = new Map(before.items.map((i) => [i.id, i]));
  for (const it of after.items) {
    const old = was.get(it.id);
    if (!old || old.design === it.design) continue;
    const why = lockBlocked(before, it.id, it.design);
    if (why) return why;
  }
  return null;
}

function setFlag(
  project: Project,
  id: string,
  key: 'boardsLocked' | 'constructionLocked',
  on: boolean,
): Project {
  const it = project.items.find((i) => i.id === id);
  if (!it || !!it[key] === on) return project;
  const rest: ProjectItem = { ...it };
  delete rest[key];
  const next: ProjectItem = on ? { ...rest, [key]: true } : rest;
  return { ...project, items: project.items.map((i) => (i.id === id ? next : i)) };
}

/** Lock or unlock a piece's boards; the flag is absent when unlocked. The same project when nothing changes. */
export const setBoardsLocked = (project: Project, id: string, on: boolean): Project =>
  setFlag(project, id, 'boardsLocked', on);
/** Lock or unlock a piece's construction; the flag is absent when unlocked. The same project when nothing changes. */
export const setConstructionLocked = (project: Project, id: string, on: boolean): Project =>
  setFlag(project, id, 'constructionLocked', on);

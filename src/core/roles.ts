/**
 * Part roles a board or an edge band can be put on (ADR-163, ADR-168), and the generated part roles each covers.
 * Pure data: the Material dialog, `applyMaterial` and `buildModel` (role bands) read it.
 */
import type { PanelRole } from './types';

/** The part groups a board can be put on. `body` = sides, top and bottom (a frame's solid members). */
export type MaterialRole =
  | 'front'
  | 'body'
  | 'top'
  | 'bottom'
  | 'side'
  | 'shelf'
  | 'divider'
  | 'back'
  | 'drawer-box'
  | 'drawer-bottom'
  | 'worktop';
export const MATERIAL_ROLES: MaterialRole[] = [
  'front',
  'body',
  'top',
  'bottom',
  'side',
  'shelf',
  'divider',
  'back',
  'drawer-box',
  'drawer-bottom',
  'worktop',
];
/** Part = one part of the item; Item = the item; Group = the selected items, else the item's run; Project = all. */
export type MaterialScope = 'part' | 'item' | 'group' | 'project';

/** The generated part roles each material role covers, to tell whether an item has such parts. */
export const ROLE_PANELS: Record<MaterialRole, PanelRole[]> = {
  front: ['door', 'drawer-front'],
  body: [
    'side',
    'top',
    'bottom',
    'leg',
    'apron',
    'stretcher',
    'slat',
    'ledger',
    'stile',
    'rung',
    'loose',
  ],
  top: ['top', 'seat', 'headboard', 'footboard'],
  bottom: ['bottom'],
  side: ['side'],
  shelf: ['shelf'],
  divider: ['divider'],
  back: ['back'],
  'drawer-box': ['drawer-side', 'drawer-back', 'drawer-inner-front'],
  'drawer-bottom': ['drawer-bottom'],
  worktop: ['worktop'],
};

/**
 * The roles a generated part belongs to, the specific one first (a side: `side`, then `body`), so a role's own
 * choice wins over the carcass-wide one.
 */
export function rolesOf(role: PanelRole): MaterialRole[] {
  const own = MATERIAL_ROLES.filter((r) => r !== 'body' && ROLE_PANELS[r].includes(role));
  return ROLE_PANELS.body.includes(role) ? [...own, 'body'] : own;
}

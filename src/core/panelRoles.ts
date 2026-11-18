import type { PanelRole } from './types';

/** Frame furniture roles (ADR-038): joinery is the maker's own, not counted as carcass joints. */
export const FRAME_ROLES: ReadonlySet<PanelRole> = new Set<PanelRole>([
  'leg',
  'apron',
  'stretcher',
  'slat',
  'ledger',
  'seat',
  'headboard',
  'footboard',
  'stile',
  'rung',
]);

/** Doors, drawer fronts and blind panels: what faces the room. */
export const FRONT_WITH_BLIND_ROLES: ReadonlySet<PanelRole> = new Set<PanelRole>([
  'door',
  'drawer-front',
  'blind-panel',
]);

/** The parts of a drawer box. */
export const DRAWER_BOX_ROLES: ReadonlySet<PanelRole> = new Set<PanelRole>([
  'drawer-side',
  'drawer-back',
  'drawer-inner-front',
  'drawer-bottom',
]);

/** Doors and drawer fronts. */
export const FRONT_ROLES: ReadonlySet<PanelRole> = new Set<PanelRole>(['door', 'drawer-front']);

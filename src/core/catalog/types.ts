import { tr } from '@furniture-builder/i18n';
import type { Design, Room } from '../designTypes';
import type { Mm } from '../kernelTypes';
import type { Product } from '../productTypes';

export type { Room };

/** Function groups and rooms used to group the catalog (ADR-032). */
export type FunctionGroup = 'kitchen' | 'storage' | 'tables' | 'seating' | 'sleeping';
export const FUNCTIONS: FunctionGroup[] = ['kitchen', 'storage', 'tables', 'seating', 'sleeping'];
export const ROOMS: Room[] = [
  'living',
  'bedroom',
  'dining',
  'office',
  'kitchen',
  'hallway',
  'kids',
  'outdoor',
  'other',
  'custom',
];
export const FUNCTION_LABEL: Record<FunctionGroup, string> = {
  kitchen: 'Kitchen cabinets',
  storage: 'Storage and display',
  tables: 'Tables and surfaces',
  seating: 'Seating',
  sleeping: 'Sleeping and lying',
};
/**
 * The shown label of a stored category (G-547, display-only mapping, user 2026-11-27). Designs store the English
 * `FUNCTION_LABEL` text as `catalog.category` (src/core/wizard/steps.ts), and that stored text never changes; every
 * place that shows a category or a function group goes through this one lookup, so each has one Russian wording.
 */
export const categoryLabel = (stored: string): string => tr(stored);
/** The shown label of a function group (G-547): its stored `FUNCTION_LABEL` text through `categoryLabel`. */
export const functionLabel = (fn: FunctionGroup): string => categoryLabel(FUNCTION_LABEL[fn]);
export const ROOM_LABEL: Record<Room, string> = {
  living: 'Living room',
  bedroom: 'Bedroom',
  dining: 'Dining room',
  office: 'Home office',
  kitchen: 'Kitchen',
  hallway: 'Hallway',
  kids: "Kids' room",
  outdoor: 'Outdoor',
  other: 'Other',
  custom: 'Custom',
};

/**
 * What a variant needs beyond today's roots (ADR-033). Built capabilities let the variant be inserted;
 * `hardware:user` inserts with a reminder to choose the hardware from its datasheet (ADR-010).
 */
export type Capability =
  | 'top:rails'
  | 'bottom:none'
  | 'appliance-niche'
  | 'root:panel'
  | 'root:frame'
  | 'front:sliding'
  | 'front:flap'
  | 'hardware:user'
  | 'shape'
  | 'front:fixed'
  | 'front:lid'
  | 'frame:arms'
  | 'frame:modules'
  | 'frame:under-storage'
  | 'safety:user-confirmed';

export const BUILT_CAPABILITIES: ReadonlySet<Capability> = new Set<Capability>([
  'top:rails',
  'bottom:none',
  'appliance-niche',
  'root:panel',
  'root:frame',
  'front:sliding',
  'front:flap',
  'hardware:user',
  'shape',
]);

/** Plain-language reason a capability is missing, shown on a greyed variant. */
export const CAPABILITY_WAITS: Partial<Record<Capability, string>> = {
  shape: 'needs angled or shaped parts (not built yet)',
  'front:fixed': 'needs a fixed false front (not built yet)',
  'front:lid': 'needs a lid hinged on the top (not built yet)',
  'frame:arms': 'needs arm rests on the frame root (not built yet)',
  'frame:modules': 'needs sofa modules joined into one piece (not built yet)',
  'frame:under-storage': 'needs drawers built into a frame (not built yet)',
  'safety:user-confirmed':
    'covered by safety standards: switch on "I check safety-regulated items myself" in the Catalog to use it',
};

type VariantKind = 'interior' | 'construction';

export interface CatalogVariant {
  id: string;
  name: string;
  summary: string;
  kind: VariantKind;
  requires: Capability[];
  /** For `hardware:user`: what the user still has to choose (a warning until cleared). */
  hardware?: string;
  /** A complete, self-contained design (ADR-011). Absent when the variant cannot be built yet. */
  create?: () => Design;
  /** Shown under Catalog › Highlights (ADR-298). */
  highlight?: true;
  /** Inserted as a kit: only the outer size and the boards stay editable (ADR-298). */
  kit?: true;
}

/** `safety`: built, but every variant waits for safety values the user confirms (ADR-035). */
type Support = 'ready' | 'needs-construction' | 'safety' | 'reference';

export interface CatalogFamily {
  id: string;
  name: string;
  nameRo: string;
  aliases: string[];
  function: FunctionGroup;
  /** First is the primary room. */
  rooms: Room[];
  /** Product root that builds it. */
  root: Product['kind'];
  support: Support;
  /** The default structure in words, for the catalog card. */
  structure: string;
  /** What can be varied, for the catalog card. */
  configurations: string[];
  dims: { min: [Mm, Mm, Mm]; max: [Mm, Mm, Mm]; widthGrid?: Mm[] };
  catalogVersion: number;
  variants: CatalogVariant[];
}

/**
 * Safety-regulated items (bunk bed, cradle) unlock once the user confirms, on this device, that they check the design
 * against the standards themselves (ADR-035). The designs keep their "not a compliance check" warning regardless.
 */
let safetyConfirmed = false;
export const setSafetyConfirmed = (v: boolean) => {
  safetyConfirmed = v;
};
export const isSafetyConfirmed = () => safetyConfirmed;
const available = (c: Capability) =>
  BUILT_CAPABILITIES.has(c) || (c === 'safety:user-confirmed' && safetyConfirmed);

export const insertable = (v: Pick<CatalogVariant, 'create' | 'requires'>) =>
  !!v.create && v.requires.every(available);
export const missingCapabilities = (v: Pick<CatalogVariant, 'requires'>) =>
  v.requires.filter((c) => !available(c));

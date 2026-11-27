/** The design document (G-548, ADR-306): what the user edits and what gets saved (ADR-011). */
import type {
  EdgeBand,
  HardwareProduct,
  Material,
  RoleBoardRole,
  SellerItem,
} from './materialTypes';
import type { Mm } from './kernelTypes';
import type { Product } from './productTypes';

/**
 * The catalog's rooms (ADR-032), here so the document names no catalog file (G-613); `catalog/types.ts` re-exports it.
 */
export type Room =
  | 'living'
  | 'bedroom'
  | 'dining'
  | 'office'
  | 'outdoor'
  | 'kitchen'
  | 'hallway'
  | 'kids'
  | 'other'
  /** Pieces that are neither classic catalog items nor one room's furniture, such as the room divider (ADR-298). */
  | 'custom';

/** Where a piece came from (ADR-028); kept on every copy, never used for geometry. */
export interface CatalogMeta {
  category?: string;
  brand?: string;
  productName?: string;
  articleNumber?: string;
  /** Hardware the user still has to choose from a maker's datasheet (ADR-033 `hardware:user`); a warning stays until cleared. */
  hardwareToChoose?: string;
  origin?: {
    catalogId: string;
    variantId?: string;
    revision: number;
    brand?: string;
    productName: string;
    sourceUrl?: string;
    takenAt: string;
    /**
     * The rooms of the user's own family it was inserted from (ADR-210, schemaVersion 9): the family rule checks a
     * piece of an `own-…` family by them. Absent for shipped families (looked up by id) and older pieces.
     */
    rooms?: Room[];
  };
  /**
   * A kit (ADR-298, schemaVersion 12): the piece was inserted as a pre-made build and only the listed edits are open;
   * the store refuses any other change to the product. "Unlock all edits" removes it. Absent = every edit is open.
   */
  kit?: { allow: KitEdit[] };
}

/** The edits a kit keeps open (ADR-298): the outer size and the boards. */
export type KitEdit = 'size' | 'boards';
export const KIT_EDITS: readonly KitEdit[] = ['size', 'boards'];

/** Guidance thresholds (ADR-035). Absent = typical defaults; all are warnings, never errors. */
export interface RuleSettings {
  /** Longest shelf span for 18 mm particleboard or MDF before a sag warning; scaled by thickness. */
  shelfSpan?: Mm;
  /** Widest single hinged door before a warning. */
  doorMaxWidth?: Mm;
  /** Least inside depth for a hanging rail. */
  hangerDepth?: Mm;
  /** Room height, for the tilt-up check. Absent = not checked. */
  roomHeight?: Mm;
}

export interface Design {
  /**
   * 2 adds stock sheets and cutting settings (ADR-019); 3 adds edge band specs on boards (ADR-077); 4 adds a
   * board per part (`partMaterials`); 5 adds seller products (ADR-161); 6 adds a board per part role
   * (`roleMaterials`, ADR-163); 7 adds a corner's mount (ADR-177); 8 adds an edge band per part role and per part
   * (`roleBands`, `partBands`, ADR-188); 9 adds the user's assembly steps and the lounger and daybed ends (ADR-207),
   * a split's `remainderFirst` (ADR-205), and the piece's own variables and bindings and an origin's rooms (ADR-210);
   * 13 adds merged assembly steps (ADR-300); 15 adds a board's leftover pieces (ADR-302). Older files are upgraded in memory on load.
   */
  schemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  materials: Material[];
  product: Product;
  /** Saw settings for sheet layouts. */
  cutting?: { kerf: Mm };
  /** Catalog metadata and origin link (ADR-028). */
  catalog?: CatalogMeta;
  /** Guidance thresholds (ADR-035). */
  settings?: { rules?: RuleSettings };
  /**
   * A board for one part instead of its group's board (schemaVersion 4): panel id → material id. A part id the piece no
   * longer builds is kept and warned about, never dropped silently. Absent = every part uses its group's board.
   */
  partMaterials?: Record<string, string>;
  /**
   * A board for every part of one role instead of its group's board (schemaVersion 6, ADR-163): tops, bottoms,
   * sides, shelves or dividers. A part's own board (`partMaterials`) wins over it. Absent = the group's board.
   */
  roleMaterials?: Partial<Record<RoleBoardRole, string>>;
  /**
   * An edge band for every part of a role instead of its board's band (schemaVersion 8, ADR-188), keyed by the
   * Material dialog's roles (`src/core/roles.ts`): a role's own entry wins over `body`. Absent = the board's band.
   */
  roleBands?: Partial<Record<string, EdgeBand>>;
  /** An edge band for one part (schemaVersion 8, ADR-188): panel id → band; wins over `roleBands`. Kept when lost. */
  partBands?: Record<string, EdgeBand>;
  /**
   * Parts the user already owns (ADR-271, schemaVersion 9): cut-list row key (`ownedKey`) → how many. They leave the
   * cut list and the sheet layouts only. A mark that matches no part now is kept and shown, never dropped. Absent = none.
   */
  ownedParts?: Record<string, number>;
  /**
   * The user's assembly steps (ADR-207, schemaVersion 9): their order and own names. Steps the order does not name
   * keep their generated place; unknown ids are ignored; an empty name keeps the generated title. Absent = generated.
   */
  assembly?: AssemblyEdit;
  /** Answers of the New-piece wizard that made this piece, so it can be reopened there (ADR-046). Never geometry. */
  wizard?: { answers: WizardAnswers };
  /** Seller products chosen for hardware lines, by shopping-list line key `hw:<label>[, <size> mm]` (ADR-161). */
  hardwareProducts?: Record<string, HardwareProduct>;
  /** Seller products added to this piece's shopping list (ADR-161). */
  sellerItems?: SellerItem[];
  /**
   * The piece's own variables (ADR-210, schemaVersion 9): the same shape and limits as a project's (ADR-166). Its
   * bindings drive width, height, depth, mountHeight and `split:*` (no positions); evaluated on each commit.
   */
  variables?: DesignVariable[];
  bindings?: DesignBinding[];
}

/** A piece's own variable (ADR-210): a named number or formula, as a project variable (ADR-166). */
export interface DesignVariable {
  id: string;
  name: string;
  expr: string;
}

/** A binding of a piece's own size to its variables (ADR-210). */
interface DesignBinding {
  target: string;
  expr: string;
}

/** The assembly steps a piece can have (ADR-174, ADR-185, ADR-186), in their generated order (`STEP_ORDER`). */
export type StepId =
  | 'prepare'
  | 'fit-hardware'
  | 'bottom'
  | 'sides'
  | 'fixed'
  | 'top'
  | 'back'
  | 'plinth'
  | 'adjustable'
  | 'drawers'
  | 'fronts'
  | 'handles'
  | 'hang'
  | 'fit'
  | 'loose'
  | 'also';

/** The user's assembly steps (ADR-207): their order, and their own names by step. */
export interface AssemblyEdit {
  order: StepId[];
  names?: Partial<Record<StepId, string>>;
  /**
   * Steps merged into the step shown before them in `order` (ADR-300, schemaVersion 13): each joins its predecessor,
   * so a run of them makes one step. Absent = no merge; a step that comes first stays on its own.
   */
  merged?: StepId[];
}

/** Wizard answers as stored: text, numbers, or a list of those or of compartments (`src/core/wizard/types.ts`). */
export type WizardAnswers = Record<
  string,
  string | number | (string | number | { kind: string; shelves: number; drawers: number })[]
>;

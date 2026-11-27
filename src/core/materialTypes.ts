/** Boards, edge bands and seller products (G-548, ADR-306): what a design's parts are made of and bought as. */
import type { Mm } from './kernelTypes';

export interface Material {
  id: string;
  name: string;
  thickness: Mm;
  /** Decor/grain direction matters: cutlist length follows the panel's grain axis. */
  grain: boolean;
  /** Display colour for the 3D view (CSS hex). */
  color: string;
  /** Stock sheet bought for this board (ADR-019). Absent in version-1 files; defaults fill it in. */
  sheet?: StockSheet;
  /**
   * Leftover pieces of this board the user owns (ADR-302, schemaVersion 15), filled before any full sheet. Length runs
   * along the grain like `sheet.length`; the board's trim applies. Absent = none.
   */
  leftovers?: Leftover[];
  /** 'solid': timber bought in lengths, listed by length instead of nested on sheets (ADR-038). Absent = sheet. */
  stock?: 'sheet' | 'solid';
  /** Solid stock: lengths you can buy, ascending (default 2400, 3000). */
  lengths?: Mm[];
  /** A picture from the user's device shown on the board's faces instead of the plain colour (ADR-048). */
  image?: MaterialImage;
  /** Labels (ADR-049): shown next to the name only; never used to fill in specs. */
  maker?: MaterialMaker;
  kind?: MaterialKind;
  /** Taken from a decor list the user imported (ADR-049): the list's code and file name, for tracing. */
  decor?: { code: string; list: string };
  /** How the board's surface looks in the 3D view and renders (ADR-067); display only. Absent = matte. */
  finish?: BoardFinish;
  /** The edge band on this board's banded edges, as the user names it from the supplier's datasheet (ADR-077). */
  band?: EdgeBand;
  /** A different band for doors and drawer fronts made of this board (ADR-077); absent = they use `band`. */
  frontBand?: EdgeBand;
  /** The seller's product this board was taken from (ADR-161, schemaVersion 5), for its price and page. */
  product?: ProductRef;
}

/**
 * ADR-161. A product of a bundled seller catalog (`src/core/sellers`): the seller's id, the product's id there, and
 * its name when it was picked, shown when the product is no longer in the catalog.
 */
export interface ProductRef {
  seller: string;
  id: string;
  name: string;
}

/** ADR-161. The seller's product for a hardware line: `per` seller units are bought for each scheduled item. */
export interface HardwareProduct extends ProductRef {
  per: number;
}

/** ADR-161. A seller product the user added to a piece's shopping list, with how many to buy. */
export interface SellerItem extends ProductRef {
  quantity: number;
}

export type EdgeBandKind = 'abs' | 'pvc' | 'pp' | 'melamine' | 'veneer' | 'other';

/**
 * ADR-077. An edge band spec, entered by the user (no standard fixes these values, ADR-010). Whole numbers:
 * `thickness` in tenths of a millimetre (0.4 mm = 4), `width` in mm.
 */
export interface EdgeBand {
  kind: EdgeBandKind;
  thickness: number;
  width: Mm;
  /** The supplier's decor or article code. */
  code?: string;
  /** Extra length per banded edge for trimming on the edgebander, counted in the metres to buy. Absent = 0. */
  allowance?: Mm;
  /** The seller's product this band was taken from (ADR-161, schemaVersion 5). */
  product?: ProductRef;
  /**
   * ADR-301 (schemaVersion 14): guidance the user types from the band's datasheet, never filled in (ADR-010). The ±
   * thickness and ± width deviation and the overhang left to trim per side, in tenths of a mm (1–100). Absent = not given.
   */
  thicknessTolerance?: number;
  widthTolerance?: number;
  overhang?: number;
  /** ADR-301 (schemaVersion 14): the user's edgebander settings for this band, as they write them. */
  edgebander?: string;
}

export type BoardFinish = 'matte' | 'satin' | 'gloss';
export type MaterialMaker = 'egger' | 'kastamonu' | 'fundermax' | 'kronospan' | 'other';
export type MaterialKind = 'pal' | 'mdf' | 'worktop' | 'other';

/**
 * ADR-048. The picture itself lives in this device's `images` table under `id`; the design keeps only the reference.
 * One copy of the picture covers `tileLength` × `tileWidth` mm of board and repeats; its width runs along the part's
 * grain axis, or across it when `turn` is set.
 */
export interface MaterialImage {
  id: string;
  /** File name as picked, for display. */
  name: string;
  tileLength: Mm;
  tileWidth: Mm;
  turn?: boolean;
}

/** One leftover piece of a board (ADR-302). */
export interface Leftover {
  length: Mm;
  width: Mm;
}

/** A full factory sheet. Length runs along the grain, matching cut-list length (ADR-009). */
interface StockSheet {
  length: Mm;
  width: Mm;
  /** Unusable margin trimmed off each edge before cutting parts. */
  trim: Mm;
  /** Sheets available; null = buy as many as needed. */
  count: number | null;
}

/** The part roles that can take a board of their own apart from their group (ADR-163). */
export type RoleBoardRole = 'top' | 'bottom' | 'side' | 'shelf' | 'divider';

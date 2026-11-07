/**
 * The shopping-list line (ADR-064) on its own, so the fastener and price modules that build or price lines do not
 * import the shopping list that imports them (ADR-236).
 */
import type { HardwareItem, ProductRef } from './types';

export type ShopSection = 'boards' | 'banding' | 'hardware' | 'run' | 'choose';
export type ShopUnit = 'sheet' | 'm2' | 'm' | 'piece';

export interface ShopLine {
  section: ShopSection;
  label: string;
  quantity: number;
  unit: ShopUnit;
  detail: string;
  /** The label and detail on the CSV and printed list, in the print language (ADR-202); absent = `label` / `detail`. */
  printLabel?: string;
  printDetail?: string;
  /** Price-list key (ADR-062); absent = not priced on its own (run parts use their board's price). */
  priceKey?: string;
  /** Boards: both measures, so a per-sheet or per-m² price can be used. Sheets null until laid out. */
  sheets?: number | null;
  m2?: number;
  /** Boards: a worktop board (kind kitchen worktop, or named like "Worktop"), so it can be priced per piece. */
  worktop?: boolean;
  /** The seller product linked to this line (ADR-161): the board's, the band's, the hardware line's or an added item. */
  product?: ProductRef;
  /** Hardware: seller units bought per scheduled item (ADR-161). Absent = 1. */
  per?: number;
  /** Hardware lines: the key a seller product is saved under (`Design.hardwareProducts`). */
  productKey?: string;
  /** Hardware lines: what the schedule calls it, to suggest products of the same kind first. */
  hardwareKind?: HardwareItem['kind'];
  sizeMm?: number;
  /** Added seller items: their place in `Design.sellerItems`, for changing or removing them. */
  itemIndex?: number;
  /** Run part lines: the run part's key in `Project.runProducts` (ADR-206). */
  runKey?: string;
  /** Run part lines: the part's length in metres, for a seller price per metre (ADR-206). */
  lengthM?: number;
}

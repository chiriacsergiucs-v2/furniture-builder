/**
 * ADR-160: the seller-agnostic product catalog the app bundles. Each seller's export is converted to this shape by
 * its own script (`tools/sellers/<seller>.mjs`); only values the seller states are kept (ADR-010). Short keys keep
 * the bundled file small.
 */

/** What a product is to the app; the seller's own category stays in `c`. */
export type ProductKind =
  | 'board'
  | 'worktop'
  | 'edge-band'
  | 'hinge'
  | 'runner'
  | 'push-latch'
  | 'flap-stay'
  | 'shelf-pin'
  | 'wall-bracket'
  | 'handle'
  | 'leg'
  | 'other';

/** What the seller's price is for. */
export type SellerUnit = 'piece' | 'm' | 'm2' | 'pack' | 'set';
export type SellerStock = 'in' | 'out' | 'order' | 'preorder' | 'online' | 'other';

export interface SellerProduct {
  /** The seller's product id, unique in its catalog. */
  id: string;
  /** Name as the seller writes it. */
  n: string;
  k: ProductKind;
  /** The seller's own category. */
  c: string;
  /** Price in whole minor units (bani, cents), as the seller states it (see `SellerCatalog.priceNote`). */
  p: number;
  u: SellerUnit;
  s: SellerStock;
  /** The seller's article code. */
  code?: string;
  /** Manufacturer. */
  m?: string;
  /** Thickness: whole mm; for edge bands in tenths of a mm (ADR-077). */
  t?: number;
  /** Edge bands: abs, pvc, melamine or other. */
  b?: 'abs' | 'pvc' | 'melamine' | 'other';
  /** Width, length and nominal length (runners), whole mm. */
  w?: number;
  l?: number;
  L?: number;
  /** The seller's specifications as one line. */
  x: string;
  /** Page path on `origin`, and picture path on `imageBase`. */
  a?: string;
  i?: string;
}

export interface SellerCatalog {
  id: string;
  name: string;
  /** https origin of the seller's site: product pages open there, only on a tap. */
  origin: string;
  /** Pictures load from here only when the user switches seller pictures on (ADR-126). */
  imageBase: string;
  currency: string;
  priceNote: string;
  /** Date of the seller's export, YYYY-MM-DD. */
  extracted: string;
  products: SellerProduct[];
}

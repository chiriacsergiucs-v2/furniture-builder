// The catalog finder's pure rules (ADR-291): which families the flat grid shows, and which seller products a kind chip
// keeps. No React, so they are unit-tested on their own.
import { FUNCTIONS, insertable, ROOMS, type FunctionGroup, type Room } from '../core/catalog';
import type { ViewFamily } from '../core/catalog/local';
import type { Offer } from '../core/sellers';
import type { ProductKind } from '../core/sellers/types';
import { matches } from './Catalog';

export interface FinderFilter {
  /** The search text, trimmed and lower-cased. */
  q: string;
  /** '' = every room; 'other' also keeps families with no room. */
  room: Room | '';
  /** '' = every type. */
  fn: FunctionGroup | '';
  /** Only families with an item that opens right away. */
  ready: boolean;
}

export const NO_FILTER: FinderFilter = { q: '', room: '', fn: '', ready: false };

/** Each family once (never once per room, unlike the grouped page), in catalog order, when it passes every filter. */
export function finderFamilies(families: ViewFamily[], f: FinderFilter): ViewFamily[] {
  return families.filter(
    (fam) =>
      (!f.room || fam.rooms.includes(f.room) || (f.room === 'other' && !fam.rooms.length)) &&
      (!f.fn || fam.function === f.fn) &&
      fam.variants.some((v) => matches(fam, v, f.q) && (!f.ready || insertable(v))),
  );
}

/** The rooms and types the finder's filters offer: only those some family has. */
export function finderRooms(families: ViewFamily[]): Room[] {
  return ROOMS.filter((r) =>
    families.some((f) => f.rooms.includes(r) || (r === 'other' && !f.rooms.length)),
  );
}
export function finderTypes(families: ViewFamily[]): FunctionGroup[] {
  return FUNCTIONS.filter((fn) => families.some((f) => f.function === fn));
}

/** The product kinds in a list, in the order they first appear (the caller's best matches first). */
export function offerKinds(offers: Offer[]): ProductKind[] {
  const seen: ProductKind[] = [];
  for (const o of offers) if (!seen.includes(o.p.k)) seen.push(o.p.k);
  return seen;
}

/** The offers of one kind; '' keeps them all. */
export const offersOfKind = (offers: Offer[], kind: ProductKind | ''): Offer[] =>
  kind ? offers.filter((o) => o.p.k === kind) : offers;

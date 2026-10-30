/**
 * Seller product catalogs (ADR-161): bundled snapshots of sellers' products, loaded as a lazy chunk the first time
 * they are needed, then matched to the boards, edge bands and hardware of a design. The user always picks; a pick
 * copies only values the seller states (ADR-010). Pure: no DOM, no storage, no request.
 */
import type {
  EdgeBand,
  EdgeBandKind,
  HardwareKind,
  Material,
  MaterialKind,
  MaterialMaker,
  ProductRef,
} from '../types';
import type { ProductKind, SellerCatalog, SellerProduct } from './types';

export type { ProductKind, SellerCatalog, SellerProduct } from './types';

/** Every bundled seller. A new seller adds its converted file and one line here. */
const SOURCES: { id: string; load: () => Promise<string> }[] = [
  { id: 'regency', load: () => import('./regency.json?raw').then((m) => m.default) },
];

let loading: Promise<SellerCatalog[]> | null = null;
let loaded: SellerCatalog[] | null = null;

/** Loads (once) and returns every seller catalog. */
export function loadSellerCatalogs(): Promise<SellerCatalog[]> {
  loading ??= Promise.all(SOURCES.map((s) => s.load().then((t) => JSON.parse(t) as SellerCatalog)))
    .then((c) => (loaded = c))
    .catch((e) => {
      loading = null;
      throw e;
    });
  return loading;
}

/** The catalogs when already loaded, else null. */
export const sellerCatalogs = () => loaded;

export interface Offer {
  seller: SellerCatalog;
  p: SellerProduct;
}

export const refOf = (o: Offer): ProductRef => ({ seller: o.seller.id, id: o.p.id, name: o.p.n });
export const refKey = (r: Pick<ProductRef, 'seller' | 'id'>) => `${r.seller}:${r.id}`;

/** Every product by `seller:id`. */
export function productIndex(cats: SellerCatalog[]): Map<string, Offer> {
  const m = new Map<string, Offer>();
  for (const seller of cats)
    for (const p of seller.products) m.set(refKey({ seller: seller.id, id: p.id }), { seller, p });
  return m;
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Every word of the query appears in the product's name, code, maker or category. */
export function matchesQuery(p: SellerProduct, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fold(`${p.n} ${p.code ?? ''} ${p.m ?? ''} ${p.c}`);
  return words.every((w) => hay.includes(w));
}

const STOCK_RANK = { in: 0, online: 1, order: 2, preorder: 3, other: 4, out: 5 } as const;

/**
 * Products of the given kinds that match the query, best first: by `score` (lower is better), then in stock, then
 * name. At most `limit`.
 */
export function searchProducts(
  cats: SellerCatalog[],
  opts: {
    kinds?: ProductKind[];
    filter?: (p: SellerProduct) => boolean;
    score?: (p: SellerProduct) => number;
    query?: string;
    limit?: number;
  },
): Offer[] {
  const kinds = opts.kinds && new Set(opts.kinds);
  const out: { o: Offer; s: number }[] = [];
  for (const seller of cats)
    for (const p of seller.products) {
      if (kinds && !kinds.has(p.k)) continue;
      if (opts.filter && !opts.filter(p)) continue;
      if (!matchesQuery(p, opts.query ?? '')) continue;
      out.push({ o: { seller, p }, s: opts.score?.(p) ?? 0 });
    }
  out.sort(
    (a, b) =>
      a.s - b.s || STOCK_RANK[a.o.p.s] - STOCK_RANK[b.o.p.s] || a.o.p.n.localeCompare(b.o.p.n),
  );
  return out.slice(0, opts.limit ?? 60).map((x) => x.o);
}

/** Boards and worktops; the board's own thickness first. */
export const boardOffers = (cats: SellerCatalog[], m: Material, query = '') =>
  searchProducts(cats, {
    kinds: ['board', 'worktop'],
    query,
    score: (p) => (p.t === m.thickness ? 0 : 1),
  });

/** Decor codes of a board: words with a digit, at least 3 characters ("U504", "112", "H1145"). */
export function decorTokens(m: Material): string[] {
  const text = [m.name, m.decor?.code, m.band?.code, m.product?.name].filter(Boolean).join(' ');
  const words = fold(shortName(text)).split(/[^a-z0-9]+/);
  return [...new Set(words.filter((w) => w.length >= 3 && /\d/.test(w)))];
}

/**
 * Edge bands that cover the board (width at least its thickness, ADR-077) with a stated thickness and width: bands
 * sharing a decor code with the board first, then the narrowest.
 */
export function bandOffers(cats: SellerCatalog[], m: Material, query = ''): Offer[] {
  const tokens = decorTokens(m);
  return searchProducts(cats, {
    kinds: ['edge-band'],
    query,
    filter: (p) => p.t !== undefined && p.w !== undefined && p.w >= m.thickness,
    score: (p) => {
      const words = fold(`${p.n} ${p.code ?? ''}`).split(/[^a-z0-9]+/);
      return (tokens.some((t) => words.includes(t)) ? 0 : 1000) + (p.w! - m.thickness);
    },
  });
}

/** The product kinds that fit a hardware line of the schedule. */
export const HARDWARE_KINDS: Partial<Record<HardwareKind, ProductKind[]>> = {
  hinge: ['hinge'],
  'corner-hinge': ['hinge'],
  'drawer-runner-pair': ['runner'],
  handle: ['handle'],
  'push-latch': ['push-latch'],
  'flap-stay': ['flap-stay'],
  'shelf-pin': ['shelf-pin'],
  'wall-bracket': ['wall-bracket'],
};

const NOT_HARDWARE: ProductKind[] = ['board', 'worktop', 'edge-band'];

/**
 * Any hardware product; the line's own kind first and, for a line with a size, the same nominal length first, then
 * products that state no length.
 */
export function hardwareOffers(
  cats: SellerCatalog[],
  kind: HardwareKind | undefined,
  sizeMm: number | undefined,
  query = '',
): Offer[] {
  const fits = new Set(kind ? (HARDWARE_KINDS[kind] ?? []) : []);
  return searchProducts(cats, {
    filter: (p) => !NOT_HARDWARE.includes(p.k),
    query,
    score: (p) =>
      (fits.has(p.k) ? 0 : 10) + (!sizeMm || p.L === sizeMm ? 0 : p.L === undefined ? 1 : 2),
  });
}

/** Any product at all (Add seller product). */
export const anyOffers = (cats: SellerCatalog[], query = '') => searchProducts(cats, { query });

const MAKER: Record<string, MaterialMaker> = {
  egger: 'egger',
  kastamonu: 'kastamonu',
  fundermax: 'fundermax',
  kronospan: 'kronospan',
};

/** "Pal melaminat Kronospan gri 112 PE, 2800 x 2070 x 18 mm" → "Pal melaminat Kronospan gri 112 PE". */
export const shortName = (n: string) =>
  n.replace(/,\s*\d+\s*x\s*\d+(\s*x\s*\d+)?\s*mm\s*$/i, '').trim();

/**
 * A board from a seller product: its name, the thickness and sheet size the seller states, the manufacturer and type
 * labels, and the link. Grain, colour, picture, trim and stock count stay as they are.
 */
export function boardPatch(o: Offer, m: Material): Partial<Material> {
  const { p } = o;
  const maker = p.m ? (MAKER[fold(p.m)] ?? 'other') : undefined;
  const cat = fold(`${p.c} ${p.n}`);
  const kind: MaterialKind =
    p.k === 'worktop'
      ? 'worktop'
      : /\bpal\b/.test(cat)
        ? 'pal'
        : /\bmdf\b/.test(cat)
          ? 'mdf'
          : 'other';
  const patch: Partial<Material> = { name: shortName(p.n), kind, product: refOf(o) };
  if (maker) patch.maker = maker;
  if (p.t && p.t <= 200) patch.thickness = p.t;
  if (p.l && p.w && p.l >= 100 && p.w >= 100 && m.stock !== 'solid') {
    const trim = m.sheet?.trim ?? 10;
    if (2 * trim < Math.min(p.l, p.w))
      patch.sheet = { length: p.l, width: p.w, trim, count: m.sheet?.count ?? null };
  }
  return patch;
}

const BAND_KIND: Record<NonNullable<SellerProduct['b']>, EdgeBandKind> = {
  abs: 'abs',
  pvc: 'pvc',
  melamine: 'melamine',
  other: 'other',
};

/** An edge band from a seller product, or null when the seller states no thickness or width. The allowance stays. */
export function bandFromOffer(o: Offer, old?: EdgeBand): EdgeBand | null {
  const { p } = o;
  if (!p.t || !p.w || p.t > 100 || p.w > 100) return null;
  return {
    kind: BAND_KIND[p.b ?? 'other'],
    thickness: p.t,
    width: p.w,
    ...(p.code ? { code: p.code.slice(0, 60) } : {}),
    ...(old?.allowance ? { allowance: old.allowance } : {}),
    product: refOf(o),
  };
}

/** The seller's price of a linked product, for the estimate (ADR-062 own prices still win). */
export interface SellerPrice {
  amount: number;
  unit: SellerProduct['u'];
  seller: string;
  date: string;
}

export function sellerPriceLookup(index: Map<string, Offer>) {
  return (r: Pick<ProductRef, 'seller' | 'id'>): SellerPrice | null => {
    const o = index.get(refKey(r));
    return o
      ? { amount: o.p.p, unit: o.p.u, seller: o.seller.name, date: o.seller.extracted }
      : null;
  };
}

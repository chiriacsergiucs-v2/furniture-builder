/**
 * The user's own price list (ADR-062): kept on this device, never fetched or invented. Amounts are whole minor units
 * (bani, cents) so sums are exact. A missing price is listed by name and the total is marked incomplete.
 */
import type { ShopLine, ShopUnit } from './shopping';

export interface PriceEntry {
  /** `board:…`, `band:…`, `hw:…`, or `currency`. */
  id: string;
  /** Per sheet or per m² for boards, per m for banding and solid stock, per piece for hardware. */
  unit: ShopUnit;
  /** Whole minor units (1 leu = 100). For `currency`: 0. */
  amount: number;
  /** For `currency`: its name. */
  text?: string;
}

export const CURRENCY_ID = 'currency';
export const DEFAULT_CURRENCY = 'lei';

/** Units a line can be priced in: boards per sheet or per m²; everything else in its own unit. */
export function unitsFor(l: ShopLine): ShopUnit[] {
  return l.section === 'boards' && l.unit !== 'm' ? ['sheet', 'm2'] : [l.unit];
}

/** Price of one line in minor units, or null when there is no usable price (or sheets are not laid out yet). */
export function linePrice(l: ShopLine, prices: Map<string, PriceEntry>): number | null {
  if (!l.priceKey) return null;
  const e = prices.get(l.priceKey);
  if (!e || !unitsFor(l).includes(e.unit)) return null;
  if (l.section === 'boards' && l.unit !== 'm') {
    if (e.unit === 'sheet')
      return l.sheets === null || l.sheets === undefined ? null : Math.round(l.sheets * e.amount);
    return Math.round((l.m2 ?? 0) * e.amount);
  }
  return Math.round(l.quantity * e.amount);
}

export interface Estimate {
  total: number;
  missing: string[];
  priced: number;
}

export function estimate(lines: ShopLine[], prices: PriceEntry[]): Estimate {
  const map = new Map(prices.map((p) => [p.id, p]));
  let total = 0,
    priced = 0;
  const missing: string[] = [];
  for (const l of lines) {
    if (!l.priceKey) continue;
    const p = linePrice(l, map);
    if (p === null) missing.push(l.label);
    else {
      total += p;
      priced++;
    }
  }
  return { total, missing, priced };
}

/** "4812,50" style: two decimals, Romanian separators. */
export const formatMoney = (minor: number) =>
  (minor / 100).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "12,5" or "12.5" → 1250; null when it is not an amount ≥ 0. */
export function parseMoney(s: string): number | null {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

const UNITS: ShopUnit[] = ['sheet', 'm2', 'm', 'piece'];

export function validatePrice(p: unknown): string[] {
  if (!p || typeof p !== 'object') return ['Invalid price'];
  const r = p as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return ['Missing price id'];
  if (r.id === CURRENCY_ID)
    return typeof r.text === 'string' && !!r.text.trim() ? [] : ['Invalid currency'];
  if (
    !UNITS.includes(r.unit as ShopUnit) ||
    typeof r.amount !== 'number' ||
    !Number.isSafeInteger(r.amount) ||
    r.amount < 0
  )
    return ['Invalid price'];
  return [];
}

/** Price list as CSV: `key;unit;price` with a comma or point for decimals. The currency is a `currency` row. */
export function pricesCsv(list: PriceEntry[]): string {
  const rows = list.map((p) =>
    p.id === CURRENCY_ID
      ? `${CURRENCY_ID};;${p.text}`
      : `${p.id};${p.unit};${(p.amount / 100).toFixed(2)}`,
  );
  return ['key;unit;price', ...rows].join('\n') + '\n';
}

export function parsePricesCsv(text: string): { prices: PriceEntry[]; problems: string[] } {
  const prices: PriceEntry[] = [],
    problems: string[] = [];
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim());
  lines.forEach((line, i) => {
    if (i === 0 && /^key;unit;price/i.test(line)) return;
    const [id, unit, price] = line.split(';').map((s) => s?.trim() ?? '');
    if (id === CURRENCY_ID) {
      if (price) prices.push({ id, unit: 'piece', amount: 0, text: price });
      else problems.push(`Row ${i + 1}: no currency name.`);
      return;
    }
    const amount = parseMoney(price ?? '');
    const e = { id, unit: unit as ShopUnit, amount: amount ?? -1 };
    if (amount === null || validatePrice(e).length)
      problems.push(`Row ${i + 1}: ${validatePrice(e)[0] ?? 'price is not a number'}.`);
    else prices.push(e);
  });
  return { prices, problems };
}

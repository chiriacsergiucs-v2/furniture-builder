/**
 * Shopping list (ADR-064): what to buy for a piece or a project, from the model only — boards (sheets from the
 * layout, or m² / metres), edge banding, scheduled hardware, run parts — plus what is still to choose before buying.
 * Screws, dowels and cams are counted only as joints of the model, as guidance; the fastener is the user's (ADR-074).
 */
import { t } from './i18n';
import { bandKey, rowBandMetres, type CutRow } from './cutlist';
import { bandText } from './materials';
import type { RunPart } from './project';
import {
  fastenerShopLines,
  notCountedPrint,
  type FastenerChoice,
  type FastenerCount,
} from './fasteners';
import { pt, type PrintKey } from './i18n/print';
import { csvCell, formatMoney, type UnitPer, type UnitPrice } from './prices';
import { materialKey } from './project';
import type {
  Diagnostic,
  HardwareItem,
  HardwareProduct,
  Material,
  ProductRef,
  SellerItem,
} from './types';

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

/** The key a run part's seller product is saved under (`Project.runProducts`, ADR-206). */
export const runPartKey = (rp: Pick<RunPart, 'key' | 'id'>) => rp.key ?? rp.id;

/**
 * The rows without the parts of run parts priced by their own product (ADR-206), so they are not bought twice: a row
 * loses those parts and goes when none is left.
 */
function withoutRunParts(rows: CutRow[], panelIds: Set<string>): CutRow[] {
  if (!panelIds.size) return rows;
  return rows.flatMap((r) => {
    const gone = r.panelIds.filter((id) => panelIds.has(id)).length;
    if (!gone) return [r];
    const quantity = r.quantity - gone;
    return quantity > 0
      ? [{ ...r, quantity, panelIds: r.panelIds.filter((id) => !panelIds.has(id)) }]
      : [];
  });
}

export const NOT_COUNTED = t(
  'Screws, dowels and cams are counted only as joints, as guidance; the fastener is yours (Settings › Fasteners). Glue is not counted.',
);

/** Checks that leave a purchase or a safety value to the user (rules registry, ADR-035). */
const CHOOSE_CODES = new Set(['hardware-to-choose', 'anti-tip', 'safety-not-checked']);

/** Hardware the user still has to choose a product for (installation drawing, fittings, fixings). */
const TO_CHOOSE = new Set([
  'appliance',
  'flap-stay',
  'front-fixing',
  'sliding-track',
  'wall-hanging',
]);

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Edge banding (ADR-077): one line per named band spec with its metres, boards that share a band combined, each
 * band's per-edge allowance added. Boards whose band is not named yet go to "to choose before buying".
 */
function bandingLines(rows: CutRow[]): ShopLine[] {
  const named = new Map<
    string,
    { label: string; metres: number; boards: string[]; extra: boolean; product?: ProductRef }
  >();
  const unnamed = new Map<string, { name: string; metres: number }>();
  for (const r of rows) {
    const metres = rowBandMetres(r);
    if (!metres) continue;
    if (!r.band) {
      const u = unnamed.get(r.materialId) ?? { name: r.materialName, metres: 0 };
      u.metres += metres;
      unnamed.set(r.materialId, u);
      continue;
    }
    const k = bandKey(r.band);
    const g = named.get(k) ?? { label: bandText(r.band), metres: 0, boards: [], extra: false };
    g.metres += metres;
    if (!g.boards.includes(r.materialName)) g.boards.push(r.materialName);
    if (r.band.allowance) g.extra = true;
    g.product ??= r.band.product;
    named.set(k, g);
  }
  const out: ShopLine[] = [];
  for (const g of named.values())
    out.push({
      section: 'banding',
      label: g.label,
      quantity: r2(g.metres),
      unit: 'm',
      detail: g.extra
        ? t('for {boards}, with the trim allowance per edge', { boards: g.boards.join(', ') })
        : t('for {boards}', { boards: g.boards.join(', ') }),
      priceKey: `band:${g.label}`,
      ...(g.product ? { product: g.product } : {}),
    });
  // Not priced: a band that is not named cannot be bought yet, like other hardware still to choose.
  for (const u of unnamed.values())
    out.push({
      section: 'choose',
      label: t('Edge band for {name}', { name: u.name }),
      quantity: r2(u.metres),
      unit: 'm',
      detail: t('name the band (type, thickness, width) on the board before buying'),
    });
  return out;
}

export function shoppingList(input: {
  rows: CutRow[];
  materials: Material[];
  hardware: HardwareItem[];
  sheets: Map<string, number> | null;
  runParts?: RunPart[];
  /** Sinks over base units (ADR-125): the base's name and the user's cut-out size. */
  sinks?: { over: string; w: number; d: number }[];
  diagnostics?: Diagnostic[];
  /** Fastener counts from the model and the user's fastener list (ADR-074). */
  fasteners?: { counts: FastenerCount[]; choices: FastenerChoice[] };
  /** Seller products chosen for hardware lines and added by the user (ADR-161). */
  hardwareProducts?: Record<string, HardwareProduct>;
  sellerItems?: SellerItem[];
  /** Seller products linked to run parts, by run part key (ADR-206, `Project.runProducts`). */
  runProducts?: Record<string, HardwareProduct>;
  /**
   * Run part keys whose linked product has a price in a unit that fits (piece or m): those parts are priced by their
   * product and leave their board's line; the others stay priced by their board, as before (ADR-206).
   */
  runPriced?: ReadonlySet<string>;
}): ShopLine[] {
  const { materials, sheets } = input;
  const priced = new Set(
    (input.runParts ?? [])
      .filter((rp) => input.runProducts?.[runPartKey(rp)] && input.runPriced?.has(runPartKey(rp)))
      .map((rp) => `run:${rp.id}`),
  );
  const rows = withoutRunParts(input.rows, priced);
  const fast = input.fasteners
    ? fastenerShopLines(input.fasteners.counts, input.fasteners.choices)
    : null;
  // The user's own shelf-pin line replaces the scheduled pins, so they are not bought twice.
  const hardware = fast?.replacesShelfPins
    ? input.hardware.filter((h) => h.kind !== 'shelf-pin')
    : input.hardware;
  const mat = new Map(materials.map((m) => [m.id, m]));
  const lines: ShopLine[] = [];
  const byMat = new Map<string, CutRow[]>();
  for (const r of rows) byMat.set(r.materialId, [...(byMat.get(r.materialId) ?? []), r]);
  for (const [id, list] of byMat) {
    const m = mat.get(id);
    const name = list[0].materialName;
    const key = m ? `board:${materialKey(m)}` : `board:${name}`;
    if (list.some((r) => r.solid)) {
      const metres = r2(list.reduce((s, r) => s + r.length * r.quantity, 0) / 1000);
      lines.push({
        section: 'boards',
        label: name,
        quantity: metres,
        unit: 'm',
        detail: t('solid stock, {n} parts', { n: list.reduce((n, r) => n + r.quantity, 0) }),
        priceKey: key,
        ...(m?.product ? { product: m.product } : {}),
      });
      continue;
    }
    const m2 = r2(list.reduce((s, r) => s + r.length * r.width * r.quantity, 0) / 1e6);
    const n = sheets?.get(id) ?? null;
    const sheet = m?.sheet;
    lines.push({
      section: 'boards',
      label: name,
      quantity: n ?? m2,
      unit: n !== null ? 'sheet' : 'm2',
      detail: sheet
        ? t('{t} mm, sheet {l} × {w}, {m2} m² of parts', {
            t: list[0].thickness,
            l: sheet.length,
            w: sheet.width,
            m2,
          })
        : t('{t} mm, {m2} m² of parts', { t: list[0].thickness, m2 }),
      priceKey: key,
      sheets: n,
      m2,
      ...(m?.kind === 'worktop' || /worktop/i.test(name) ? { worktop: true } : {}),
      ...(m?.product ? { product: m.product } : {}),
    });
  }
  const banding = bandingLines(rows);
  lines.push(...banding.filter((l) => l.section === 'banding'));
  for (const h of hardware) {
    const size = h.sizeMm ? `, ${h.sizeMm} mm` : '';
    const productKey = `hw:${h.label}${size}`;
    const link = input.hardwareProducts?.[productKey];
    const seller: Partial<ShopLine> = {
      productKey,
      hardwareKind: h.kind,
      ...(h.sizeMm ? { sizeMm: h.sizeMm } : {}),
      ...(link
        ? { product: { seller: link.seller, id: link.id, name: link.name }, per: link.per }
        : {}),
    };
    // A product still to choose moves to Hardware once the user links a seller product to it (ADR-161).
    if (TO_CHOOSE.has(h.kind) && !link)
      lines.push({
        section: 'choose',
        label: h.label,
        quantity: h.quantity,
        unit: 'piece',
        detail: h.note ?? t('choose the product before buying'),
        ...seller,
      });
    else
      lines.push({
        section: 'hardware',
        label: `${h.label}${size}`,
        quantity: h.quantity,
        unit: 'piece',
        detail: h.note ?? '',
        priceKey: productKey,
        ...seller,
      });
  }
  (input.sellerItems ?? []).forEach((it, i) =>
    lines.push({
      section: 'hardware',
      label: it.name,
      quantity: it.quantity,
      unit: 'piece',
      detail: t('added from a seller'),
      priceKey: `item:${it.seller}:${it.id}`,
      product: { seller: it.seller, id: it.id, name: it.name },
      itemIndex: i,
    }),
  );
  // A fastener line takes its seller product (ADR-206); one still to choose moves to Hardware once linked.
  if (fast)
    for (const l of fast.lines) {
      const link = l.productKey ? input.hardwareProducts?.[l.productKey] : undefined;
      if (!link) {
        lines.push(l);
        continue;
      }
      const product = { seller: link.seller, id: link.id, name: link.name };
      // Set on the line itself: its print texts are getters read in the print language at print time (ADR-202).
      lines.push(
        Object.assign(
          l,
          l.section === 'choose'
            ? { section: 'hardware' as const, priceKey: l.productKey, product, per: link.per }
            : { product, per: link.per },
        ),
      );
    }
  const seen = new Set<string>();
  for (const d of input.diagnostics ?? []) {
    if (!CHOOSE_CODES.has(d.code) || seen.has(d.message)) continue;
    seen.add(d.message);
    lines.push({
      section: 'choose',
      label:
        d.code === 'safety-not-checked'
          ? t('Safety check (yours)')
          : d.code === 'anti-tip'
            ? t('Anti-tip fixing')
            : t('Hardware from a datasheet'),
      quantity: 1,
      unit: 'piece',
      detail: d.message,
    });
  }
  lines.push(...banding.filter((l) => l.section === 'choose'));
  // The sink is the user's to choose; only its cut-out is known (ADR-125, ADR-010).
  for (const sk of input.sinks ?? [])
    lines.push({
      section: 'choose',
      label: t('Sink (your choice)'),
      quantity: 1,
      unit: 'piece',
      detail: t('cut-out {w} × {d} mm in the worktop over {over}', {
        w: sk.w,
        d: sk.d,
        over: sk.over,
      }),
    });
  for (const rp of input.runParts ?? []) {
    const runKey = runPartKey(rp);
    const link = input.runProducts?.[runKey];
    const own = !!link && !!input.runPriced?.has(runKey);
    const size = { w: rp.box.w, h: rp.box.h, d: rp.box.d, material: rp.material.name };
    lines.push({
      section: 'run',
      label: rp.label,
      quantity: 1,
      unit: 'piece',
      detail: own
        ? t('{w} × {h} × {d} mm, {material} (priced by its product)', size)
        : t('{w} × {h} × {d} mm, {material} (counted under Boards)', size),
      runKey,
      lengthM: Math.max(rp.box.w, rp.box.h, rp.box.d) / 1000,
      ...(link
        ? { product: { seller: link.seller, id: link.id, name: link.name }, per: link.per }
        : {}),
      ...(own ? { priceKey: `run:${runKey}` } : {}),
    });
  }
  return lines;
}

/** The CSV's units and the section titles of the CSV and the printed list, in the print language (ADR-181). */
const UNIT_PRINT: Record<ShopUnit, PrintKey> = { sheet: 'plăci', m2: 'm²', m: 'm', piece: 'buc' };
const SECTION_PRINT: Record<ShopSection, PrintKey> = {
  boards: 'Plăci',
  banding: 'Cant',
  hardware: 'Feronerie',
  run: 'Piese de linie',
  choose: 'De ales înainte de cumpărare',
};

/** A section title on the printed list and in the CSV, in the print language (ADR-181). */
export function shopSectionPrint(s: ShopSection): string {
  return pt(SECTION_PRINT[s]);
}

/** What a unit price is per, on the printed list and in the CSV (ADR-181), in the print language. */
const PER_PRINT: Record<UnitPer, PrintKey> = {
  sheet: '/ placă',
  m2: '/ m²',
  m: '/ m',
  piece: '/ buc',
  worktop: '/ blat',
};

/** "45,00 lei / m²" (ADR-181): a unit price for the printed list, the unit in the print language. */
export function unitPricePrint(u: UnitPrice, currency: string): string {
  return `${formatMoney(u.amount)} ${currency} ${pt(PER_PRINT[u.per])}`;
}

/**
 * Shopping list as CSV (`;`), like the Parts CSV (ADR-020): headers, sections and units in the print language,
 * Romanian by default (ADR-157, ADR-181). With `unitOf`, a Unit price column after the price: "45,00 / m²".
 */
export function shoppingCsvRo(
  lines: ShopLine[],
  priceOf?: (l: ShopLine) => number | null,
  currency = 'lei',
  unitOf?: (l: ShopLine) => UnitPrice | null,
): string {
  const esc = csvCell;
  const money = (minor: number) => (minor / 100).toFixed(2).replace('.', ',');
  const head = [
    pt('Secțiune'),
    pt('Articol'),
    pt('Cantitate'),
    pt('UM'),
    pt('Detalii'),
    ...(priceOf ? [`${pt('Preț')} (${currency})`] : []),
    ...(unitOf ? [`${pt('Preț unitar')} (${currency})`] : []),
  ];
  const body = lines.map((l) => {
    const p = priceOf?.(l);
    const u = unitOf?.(l);
    return [
      shopSectionPrint(l.section),
      l.printLabel ?? l.label,
      String(l.quantity).replace('.', ','),
      pt(UNIT_PRINT[l.unit]),
      l.printDetail ?? l.detail,
      ...(priceOf ? [p === null || p === undefined ? '' : money(p)] : []),
      ...(unitOf ? [u ? `${money(u.amount)} ${pt(PER_PRINT[u.per])}` : ''] : []),
    ]
      .map(esc)
      .join(';');
  });
  return '\uFEFF' + [head.join(';'), ...body, esc(notCountedPrint())].join('\r\n') + '\r\n';
}

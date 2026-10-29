/**
 * Shopping list (ADR-064): what to buy for a piece or a project, from the model only — boards (sheets from the
 * layout, or m² / metres), edge banding, scheduled hardware, run parts — plus what is still to choose before buying.
 * Screws, dowels and cams are counted only as joints of the model, as guidance; the fastener is the user's (ADR-074).
 */
import { bandKey, rowBandMetres, type CutRow } from './cutlist';
import { bandText } from './materials';
import type { RunPart } from './project';
import { fastenerShopLines, type FastenerChoice, type FastenerCount } from './fasteners';
import { csvCell } from './prices';
import { materialKey } from './project';
import type { Diagnostic, HardwareItem, Material } from './types';

export type ShopSection = 'boards' | 'banding' | 'hardware' | 'run' | 'choose';
export type ShopUnit = 'sheet' | 'm2' | 'm' | 'piece';

export interface ShopLine {
  section: ShopSection;
  label: string;
  quantity: number;
  unit: ShopUnit;
  detail: string;
  /** Price-list key (ADR-062); absent = not priced on its own (run parts use their board's price). */
  priceKey?: string;
  /** Boards: both measures, so a per-sheet or per-m² price can be used. Sheets null until laid out. */
  sheets?: number | null;
  m2?: number;
  /** Boards: a worktop board (kind kitchen worktop, or named like "Worktop"), so it can be priced per piece. */
  worktop?: boolean;
}

export const NOT_COUNTED =
  'Screws, dowels and cams are counted only as joints, as guidance; the fastener is yours (Materials › Fasteners). Glue is not counted.';

/** Checks that leave a purchase or a safety value to the user (rules registry, ADR-035). */
const CHOOSE_CODES = new Set(['hardware-to-choose', 'anti-tip', 'safety-not-checked']);

/** Hardware the user still has to choose a product for (installation drawing, fittings, fixings). */
const TO_CHOOSE = new Set(['appliance', 'flap-stay', 'front-fixing', 'sliding-track']);

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Edge banding (ADR-077): one line per named band spec with its metres, boards that share a band combined, each
 * band's per-edge allowance added. Boards whose band is not named yet go to "to choose before buying".
 */
function bandingLines(rows: CutRow[]): ShopLine[] {
  const named = new Map<
    string,
    { label: string; metres: number; boards: string[]; extra: boolean }
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
    named.set(k, g);
  }
  const out: ShopLine[] = [];
  for (const g of named.values())
    out.push({
      section: 'banding',
      label: g.label,
      quantity: r2(g.metres),
      unit: 'm',
      detail: `for ${g.boards.join(', ')}${g.extra ? ', with the trim allowance per edge' : ''}`,
      priceKey: `band:${g.label}`,
    });
  // Not priced: a band that is not named cannot be bought yet, like other hardware still to choose.
  for (const u of unnamed.values())
    out.push({
      section: 'choose',
      label: `Edge band for ${u.name}`,
      quantity: r2(u.metres),
      unit: 'm',
      detail: 'name the band (type, thickness, width) on the board before buying',
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
}): ShopLine[] {
  const { rows, materials, sheets } = input;
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
        detail: `solid stock, ${list.reduce((n, r) => n + r.quantity, 0)} parts`,
        priceKey: key,
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
      detail: `${list[0].thickness} mm${sheet ? `, sheet ${sheet.length} × ${sheet.width}` : ''}, ${m2} m² of parts`,
      priceKey: key,
      sheets: n,
      m2,
      ...(m?.kind === 'worktop' || /worktop/i.test(name) ? { worktop: true } : {}),
    });
  }
  const banding = bandingLines(rows);
  lines.push(...banding.filter((l) => l.section === 'banding'));
  for (const h of hardware) {
    const size = h.sizeMm ? `, ${h.sizeMm} mm` : '';
    if (TO_CHOOSE.has(h.kind))
      lines.push({
        section: 'choose',
        label: h.label,
        quantity: h.quantity,
        unit: 'piece',
        detail: h.note ?? 'choose the product before buying',
      });
    else
      lines.push({
        section: 'hardware',
        label: `${h.label}${size}`,
        quantity: h.quantity,
        unit: 'piece',
        detail: h.note ?? '',
        priceKey: `hw:${h.label}${size}`,
      });
  }
  if (fast) lines.push(...fast.lines);
  const seen = new Set<string>();
  for (const d of input.diagnostics ?? []) {
    if (!CHOOSE_CODES.has(d.code) || seen.has(d.message)) continue;
    seen.add(d.message);
    lines.push({
      section: 'choose',
      label:
        d.code === 'safety-not-checked'
          ? 'Safety check (yours)'
          : d.code === 'anti-tip'
            ? 'Anti-tip fixing'
            : 'Hardware from a datasheet',
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
      label: 'Sink (your choice)',
      quantity: 1,
      unit: 'piece',
      detail: `cut-out ${sk.w} × ${sk.d} mm in the worktop over ${sk.over}`,
    });
  for (const rp of input.runParts ?? []) {
    lines.push({
      section: 'run',
      label: rp.label,
      quantity: 1,
      unit: 'piece',
      detail: `${rp.box.w} × ${rp.box.h} × ${rp.box.d} mm, ${rp.material.name} (counted under Boards)`,
    });
  }
  return lines;
}

const UNIT_RO: Record<ShopUnit, string> = { sheet: 'plăci', m2: 'm²', m: 'm', piece: 'buc' };
const SECTION_RO: Record<ShopSection, string> = {
  boards: 'Plăci',
  banding: 'Cant',
  hardware: 'Feronerie',
  run: 'Piese de linie',
  choose: 'De ales înainte de cumpărare',
};

/** Shopping list as Romanian CSV (`;`), like the Parts CSV (ADR-020). */
export function shoppingCsvRo(
  lines: ShopLine[],
  priceOf?: (l: ShopLine) => number | null,
  currency = 'lei',
): string {
  const esc = csvCell;
  const head = [
    'Secțiune',
    'Articol',
    'Cantitate',
    'UM',
    'Detalii',
    ...(priceOf ? [`Preț (${currency})`] : []),
  ];
  const body = lines.map((l) => {
    const p = priceOf?.(l);
    return [
      SECTION_RO[l.section],
      l.label,
      String(l.quantity).replace('.', ','),
      UNIT_RO[l.unit],
      l.detail,
      ...(priceOf
        ? [p === null || p === undefined ? '' : (p / 100).toFixed(2).replace('.', ',')]
        : []),
    ]
      .map(esc)
      .join(';');
  });
  return '\uFEFF' + [head.join(';'), ...body, esc(NOT_COUNTED)].join('\r\n') + '\r\n';
}

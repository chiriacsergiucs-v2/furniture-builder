/**
 * Shopping list (ADR-064): what to buy for a piece or a project, from the model only — boards (sheets from the
 * layout, or m² / metres), edge banding, scheduled hardware, run parts — plus what is still to choose before buying.
 * Screws, dowels, cams and glue are not modelled, so they are not counted (ADR-010).
 */
import { bandMetersFromRows, type CutRow } from './cutlist';
import type { RunPart } from './project';
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
}

export const NOT_COUNTED =
  'Screws, dowels, cams and glue are not counted: they are not in the model.';

/** Checks that leave a purchase or a safety value to the user (rules registry, ADR-035). */
const CHOOSE_CODES = new Set(['hardware-to-choose', 'anti-tip', 'safety-not-checked']);

/** Hardware the user still has to choose a product for (installation drawing, fittings, fixings). */
const TO_CHOOSE = new Set(['appliance', 'flap-stay', 'front-fixing', 'sliding-track']);

const r2 = (v: number) => Math.round(v * 100) / 100;

export function shoppingList(input: {
  rows: CutRow[];
  materials: Material[];
  hardware: HardwareItem[];
  sheets: Map<string, number> | null;
  runParts?: RunPart[];
  diagnostics?: Diagnostic[];
}): ShopLine[] {
  const { rows, materials, hardware, sheets } = input;
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
    });
  }
  for (const [id, metres] of bandMetersFromRows(rows)) {
    const m = mat.get(id);
    const name = rows.find((r) => r.materialId === id)?.materialName ?? id;
    lines.push({
      section: 'banding',
      label: `Edge band for ${name}`,
      quantity: r2(metres),
      unit: 'm',
      detail: 'banded edges of the parts',
      priceKey: `band:${m ? materialKey(m) : name}`,
    });
  }
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
  const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
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

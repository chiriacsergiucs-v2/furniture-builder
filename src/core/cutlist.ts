import { cutDimensions } from './geometry';
import { shapeNote } from './shape';
import type { FurnitureModel, HardwareItem, Material, Mm, Panel } from './types';

/** "Drawer 2 side L" → "Drawer side L" so identical parts share one label. */
export const baseLabel = (label: string) => label.replace(/\s\d+\b/g, '').trim() || label;

/** "2 rows × 14 holes ø5, 37 mm from edges, one face" — what the panel shop drills. */
export function drillingText(p: Panel): string {
  const parts: string[] = [];
  if (p.pinRows?.length) {
    parts.push(
      p.pinRows
        .map(
          (r) =>
            `${r.rows.length} rows × ${r.holes.length} holes ø${r.diameter}, ${r.rows[0]} mm from edges`,
        )
        .join('; ') +
        (new Set(p.pinRows.map((r) => r.face)).size > 1
          ? ' (both faces, offset 16 mm)'
          : ', one face'),
    );
  }
  if (p.handleHoles) {
    parts.push(
      `handle ${p.handleHoles.at.length === 1 ? 'hole' : 'holes'} ø${p.handleHoles.diameter} at ${p.handleHoles.at.map(([u, v]) => `${u}/${v}`).join(', ')} mm from left/bottom`,
    );
  }
  const shaped = shapeNote(p);
  if (shaped) parts.push(shaped);
  return parts.join('; ');
}

export interface CutRow {
  materialId: string;
  materialName: string;
  thickness: Mm;
  /** Along the grain (or the longer side for grainless boards). */
  length: Mm;
  width: Mm;
  quantity: number;
  /** Banded edges along the length / along the width (0–2 each). */
  edgesL: number;
  edgesW: number;
  grain: boolean;
  /** Shelf-pin drilling summary, empty when none (ADR-023). */
  drilling: string;
  /** Solid timber: cut from lengths, never nested on sheets (ADR-038). */
  solid?: boolean;
  labels: string[];
  panelIds: string[];
}

/**
 * Group identical parts. Sizes are finished sizes; banded edges are annotated (L/W counts),
 * not subtracted — the panel shop applies its own edge-band allowance.
 */
export function cutlist(model: FurnitureModel, materials: Material[]): CutRow[] {
  const mats = new Map(materials.map((m) => [m.id, m]));
  const rows = new Map<string, CutRow>();
  for (const p of model.panels) {
    const m = mats.get(p.materialId);
    if (!m) continue;
    const c = cutDimensions(p, m.grain);
    const drilling = drillingText(p);
    const key = [m.id, c.thickness, c.length, c.width, c.edgesL, c.edgesW, drilling].join('|');
    const row = rows.get(key);
    if (row) {
      row.quantity++;
      row.panelIds.push(p.id);
      const base = baseLabel(p.label);
      if (!row.labels.includes(base)) row.labels.push(base);
    } else {
      rows.set(key, {
        materialId: m.id,
        materialName: m.name,
        thickness: c.thickness,
        length: c.length,
        width: c.width,
        quantity: 1,
        edgesL: c.edgesL,
        edgesW: c.edgesW,
        grain: m.grain,
        drilling,
        labels: [baseLabel(p.label)],
        panelIds: [p.id],
        ...(m.stock === 'solid' ? { solid: true } : {}),
      });
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      a.materialName.localeCompare(b.materialName) ||
      b.thickness - a.thickness ||
      b.length - a.length ||
      b.width - a.width,
  );
}

/** Merge identical hardware lines across the design. */
export function hardwareSummary(model: FurnitureModel): HardwareItem[] {
  const out = new Map<string, HardwareItem>();
  for (const h of model.hardware) {
    const key = `${h.kind}|${h.sizeMm ?? ''}|${h.label}|${h.note ?? ''}`;
    const cur = out.get(key);
    if (cur) cur.quantity += h.quantity;
    else out.set(key, { ...h });
  }
  return [...out.values()];
}

export const areaM2 = (rows: CutRow[], materialId: string) =>
  rows
    .filter((r) => r.materialId === materialId)
    .reduce((s, r) => s + r.length * r.width * r.quantity, 0) / 1e6;

export function edgeBandMeters(model: FurnitureModel, materials: Material[]): Map<string, number> {
  const mats = new Map(materials.map((m) => [m.id, m]));
  const out = new Map<string, number>();
  for (const p of model.panels) {
    const m = mats.get(p.materialId);
    if (!m) continue;
    const c = cutDimensions(p, m.grain);
    const mm = c.edgesL * c.length + c.edgesW * c.width;
    if (mm) out.set(m.id, (out.get(m.id) ?? 0) + mm / 1000);
  }
  return out;
}

/** Metres of edge band per material from cut rows (works for a piece or a whole project). */
export function bandMetersFromRows(rows: CutRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    const mm = (r.edgesL * r.length + r.edgesW * r.width) * r.quantity;
    if (mm) out.set(r.materialId, (out.get(r.materialId) ?? 0) + mm / 1000);
  }
  return out;
}

/** One bought length and the parts cut from it. */
export interface StockBar {
  stock: Mm;
  parts: { length: Mm; label: string }[];
  waste: Mm;
}
export interface LengthsGroup {
  materialId: string;
  materialName: string;
  section: string;
  bars: StockBar[];
  tooLong: { length: Mm; label: string }[];
}

/**
 * Solid parts as a lengths list (ADR-038): per material and section (thickness × width), parts are packed longest
 * first into the shortest bought length that still takes them (first fit decreasing), with a saw cut between parts.
 * A heuristic, never claimed optimal.
 */
export function lengthsList(
  rows: CutRow[],
  stockLengths: (materialId: string) => Mm[],
  kerf: Mm,
): LengthsGroup[] {
  const groups = new Map<string, LengthsGroup & { items: { length: Mm; label: string }[] }>();
  for (const r of rows) {
    if (!r.solid) continue;
    const section = `${r.thickness} × ${r.width}`;
    const key = `${r.materialId}|${section}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        materialId: r.materialId,
        materialName: r.materialName,
        section,
        bars: [],
        tooLong: [],
        items: [],
      };
      groups.set(key, g);
    }
    // One label per part: a row of identical parts may carry several names ("Side rail left, Side rail right").
    for (let i = 0; i < r.quantity; i++)
      g.items.push({ length: r.length, label: r.labels[Math.min(i, r.labels.length - 1)] });
  }
  const out: LengthsGroup[] = [];
  for (const g of groups.values()) {
    const stock = [...stockLengths(g.materialId)].sort((a, b) => a - b);
    const longest = stock[stock.length - 1] ?? 0;
    const items = [...g.items].sort((a, b) => b.length - a.length);
    const open: { stock: Mm; parts: { length: Mm; label: string }[]; used: Mm }[] = [];
    for (const it of items) {
      if (it.length > longest) {
        g.tooLong.push(it);
        continue;
      }
      const bar = open.find((b) => b.used + (b.parts.length ? kerf : 0) + it.length <= b.stock);
      if (bar) {
        bar.used += (bar.parts.length ? kerf : 0) + it.length;
        bar.parts.push(it);
        continue;
      }
      open.push({ stock: longest, parts: [it], used: it.length });
    }
    // Each bar can then be bought in the shortest stocked length that still holds its parts.
    const bars = open.map((b) => {
      const s = stock.find((l) => l >= b.used) ?? b.stock;
      return { stock: s, parts: b.parts, waste: s - b.used };
    });
    out.push({
      materialId: g.materialId,
      materialName: g.materialName,
      section: g.section,
      bars,
      tooLong: g.tooLong,
    });
  }
  return out;
}

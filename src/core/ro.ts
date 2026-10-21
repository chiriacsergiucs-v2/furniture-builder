/**
 * Romanian wording for what goes to the panel shop: printed sheets and the parts CSV (ADR-0020).
 * The app UI stays English. Pure functions, no UI imports.
 */
import { baseLabel, type CutRow } from './cutlist'
import type { HardwareItem } from './types'

const PART: Record<string, string> = {
  'Left side': 'Lateral stânga',
  'Right side': 'Lateral dreapta',
  Top: 'Capac',
  Bottom: 'Bază',
  Back: 'Spate',
  Plinth: 'Plintă',
  Divider: 'Despărțitor',
  'Fixed shelf': 'Raft fix',
  Shelf: 'Raft',
  'Adjustable shelf': 'Raft mobil',
  Door: 'Ușă',
  'Door left': 'Ușă stânga',
  'Door right': 'Ușă dreapta',
  'Drawer front': 'Front sertar',
  'Drawer side': 'Lateral sertar',
  'Drawer back': 'Spate sertar',
  'Drawer inner front': 'Față interioară sertar',
  'Drawer bottom': 'Fund sertar',
  Worktop: 'Blat',
  'Left gable': 'Picior lateral stânga',
  'Right gable': 'Picior lateral dreapta',
  'Modesty panel': 'Panou de modestie',
}

/** "Drawer 2 side" → "Lateral sertar". Unknown labels pass through unchanged. */
export const partRo = (label: string): string => PART[baseLabel(label)] ?? label

/** Drilling summary in Romanian (pin rows and handle holes). */
export function drillingRo(text: string): string {
  if (!text) return ''
  return text
    .replace(/(\d+) rows × (\d+) holes ø(\d+), (\d+) mm from edges/g, '$1 rânduri × $2 găuri ø$3, la $4 mm de margini')
    .replace(/\(both faces, offset 16 mm\)/g, '(ambele fețe, decalat 16 mm)')
    .replace(/, one face/g, ', o față')
    .replace(/handle holes ø(\d+) at/g, 'găuri mâner ø$1 la')
    .replace(/handle hole ø(\d+) at/g, 'gaură mâner ø$1 la')
    .replace(/mm from left\/bottom/g, 'mm de la stânga/jos')
}

export function hardwareRo(h: HardwareItem): { item: string; note: string } {
  const perDoor = /^(\d+) per door/.exec(h.note ?? '')?.[1]
  switch (h.kind) {
    case 'drawer-runner-pair': return { item: 'Pereche glisiere cu bile, montaj lateral', note: `joc ${/(\d+(?:\.\d+)?) mm/.exec(h.note ?? '')?.[1] ?? ''} mm pe parte`.trim() }
    case 'hinge': return { item: 'Balama aplicată, cupă 35 mm, soft-close, clip-on', note: perDoor ? `${perDoor} pe ușă (orientativ — verificați fișa tehnică)` : '' }
    case 'clothes-rail': return { item: 'Bară haine', note: 'tăiată la lățimea golului' }
    case 'rail-support': return { item: 'Suport bară haine', note: '' }
    case 'shelf-pin': return { item: 'Suport raft (pin) ø5', note: '4 pe raft mobil' }
    case 'handle': {
      const s = /(\d+) mm centres/.exec(h.label)?.[1]
      return { item: s ? `Mâner, ${s} mm între găuri` : 'Buton', note: '' }
    }
    case 'push-latch': return { item: 'Sistem push-to-open', note: 'balamale fără arc de închidere la uși' }
  }
}

export const CSV_HEADERS_RO = ['Denumire', 'Material', 'Grosime', 'Lungime', 'Lățime', 'Buc.', 'Cant L', 'Cant l', 'Fibră', 'Găurire']

/**
 * Parts CSV for Romanian panel shops: semicolon-separated (Romanian Excel's list separator), UTF-8 with BOM so
 * diacritics open correctly, formula-leading cells escaped. Sizes are finished sizes (ADR-0009).
 */
export function cutlistCsvRo(rows: CutRow[]): string {
  const esc = (v: string | number) => {
    const s = String(v)
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
    return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  const lines = [CSV_HEADERS_RO, ...rows.map(r => [
    [...new Set(r.labels.map(partRo))].join(' / '), r.materialName, r.thickness, r.length, r.width, r.quantity,
    r.edgesL, r.edgesW, r.grain ? 'pe lungime' : 'nu', drillingRo(r.drilling),
  ])]
  return '﻿' + lines.map(l => l.map(esc).join(';')).join('\r\n') + '\r\n'
}

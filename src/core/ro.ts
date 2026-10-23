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
  'Blind panel': 'Panou orb',
  'Top rail front': 'Traversă sus față',
  'Top rail back': 'Traversă sus spate',
  'Sliding door': 'Ușă glisantă',
  'Lift-up flap': 'Clapă rabatabilă sus',
  'Drop-down flap': 'Clapă rabatabilă jos',
  'Dishwasher front': 'Front mașină de spălat vase',
  'Fridge door front': 'Front ușă frigider',
  'Cover panel': 'Panou de capăt',
  Filler: 'Completare',
  'Table top': 'Blat masă',
  Seat: 'Șezut',
  'Seat slat': 'Șipcă șezut',
  'Table top slat': 'Șipcă blat',
  'Front leg left': 'Picior față stânga',
  'Front leg right': 'Picior față dreapta',
  'Back post left': 'Montant spătar stânga',
  'Back post right': 'Montant spătar dreapta',
  'Rail front': 'Tăblie față',
  'Rail back': 'Tăblie spate',
  'Rail left': 'Tăblie stânga',
  'Rail right': 'Tăblie dreapta',
  'Stretcher front': 'Legătură față',
  'Stretcher back': 'Legătură spate',
  'Stretcher left': 'Legătură stânga',
  'Stretcher right': 'Legătură dreapta',
  'Stretcher middle': 'Legătură mijloc',
  'Lower shelf': 'Raft jos',
  'Back panel': 'Panou spătar',
  'Back rail top': 'Traversă spătar sus',
  'Back rail bottom': 'Traversă spătar jos',
  'Back slat': 'Șipcă spătar',
  Headboard: 'Tăblie cap',
  Footboard: 'Tăblie picioare',
  'Side panel': 'Panou lateral',
  'Side rail left': 'Lonjeron stânga',
  'Side rail right': 'Lonjeron dreapta',
  'Slat ledger left': 'Șipcă suport stânga',
  'Slat ledger right': 'Șipcă suport dreapta',
  Slat: 'Șipcă',
  'Centre rail': 'Lonjeron central',
  'Centre leg': 'Picior central',
  'Guard rail left': 'Balustradă stânga',
  'Guard rail right': 'Balustradă dreapta',
  'Ladder stile left': 'Montant scară stânga',
  'Ladder stile right': 'Montant scară dreapta',
  'Ladder rung': 'Treaptă scară',
}

/** "Drawer 2 side" → "Lateral sertar"; "Base cabinet: Left side" → "Base cabinet: Lateral stânga". Unknown labels pass through. */
export function partRo(label: string): string {
  const i = label.lastIndexOf(': ')
  if (i >= 0) return `${label.slice(0, i)}: ${partRo(label.slice(i + 2))}`
  return PART[baseLabel(label)] ?? label
}

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
    .replace(/cut to template \((\d+) points\)/g, 'tăiere după șablon ($1 puncte)')
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
    case 'wall-bracket': return { item: 'Agățătoare reglabilă pentru corp suspendat', note: 'câte una în colțurile de sus din spate (verificați fișa tehnică și tipul peretelui)' }
    case 'wall-rail': return { item: 'Șină de perete pentru agățători', note: 'tăiată la lățimea corpului' }
    case 'corner-hinge': return { item: 'Set balama de colț (leagă cele două uși)', note: 'verificați setul și balamalele înlocuite în fișa tehnică' }
    case 'wall-fixing': return { item: 'Prindere anti-răsturnare în perete', note: 'alegeți diblurile după tipul peretelui (orientativ)' }
    case 'appliance': return { item: h.label.replace(/^Built-in /, 'Electrocasnic încorporat: '), note: 'verificați nișa după desenul de montaj al aparatului' }
    case 'front-fixing': return { item: 'Kit prindere front', note: 'de obicei livrat cu aparatul — verificați desenul de montaj' }
    case 'sliding-track': return { item: 'Șină uși glisante, sus și jos', note: 'verificați sistemul glisant în fișa tehnică' }
    case 'flap-stay': return { item: 'Mecanism clapă', note: 'alegeți după greutatea și înălțimea frontului (fișa tehnică)' }
    case 'purchased': return { item: h.label, note: h.note ?? '' }
    case 'screws': return { item: 'Șuruburi pentru PAL', note: `${h.note ?? ''} — alegeți tipul, lungimea și numărul (orientativ)`.trim() }
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

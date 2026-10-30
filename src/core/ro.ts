/**
 * Wording for what goes to the panel shop: printed sheets and the parts CSV (ADR-020), in the print language
 * (ADR-157): Romanian by default, Russian or English when chosen. Romanian text is the key of `pt()`. Pure
 * functions, no UI imports.
 */
import { baseLabel, boardBandText, type CutRow } from './cutlist';
import { getPrintLang, pt, type PrintKey } from './i18n/print';
import { tenthsText } from './materials';
import type { EdgeBand, EdgeBandKind, HardwareItem } from './types';

/** Generated part names (English, as the generators name them) in Romanian. */
const PART = {
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
  'Common top': 'Capac comun',
  'Common bottom': 'Bază comună',
  Crown: 'Cornișă',
  Pelmet: 'Pazie inferioară',
  'Ceiling filler': 'Completare până la tavan',
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
} satisfies Record<string, string>;

type PartName = keyof typeof PART;

/** The same part names in Russian. */
const PART_RU: Record<PartName, string> = {
  'Left side': 'Боковина левая',
  'Right side': 'Боковина правая',
  Top: 'Крышка',
  Bottom: 'Дно',
  Back: 'Задняя стенка',
  Plinth: 'Цоколь',
  Divider: 'Перегородка',
  'Fixed shelf': 'Полка неподвижная',
  Shelf: 'Полка',
  'Adjustable shelf': 'Полка съёмная',
  Door: 'Дверца',
  'Door left': 'Дверца левая',
  'Door right': 'Дверца правая',
  'Drawer front': 'Фасад ящика',
  'Drawer side': 'Боковина ящика',
  'Drawer back': 'Задняя стенка ящика',
  'Drawer inner front': 'Передняя стенка ящика',
  'Drawer bottom': 'Дно ящика',
  Worktop: 'Столешница',
  'Left gable': 'Опора боковая левая',
  'Right gable': 'Опора боковая правая',
  'Modesty panel': 'Царга передняя (экран)',
  'Blind panel': 'Глухая панель',
  'Top rail front': 'Царга верхняя передняя',
  'Top rail back': 'Царга верхняя задняя',
  'Sliding door': 'Дверь-купе',
  'Lift-up flap': 'Фасад подъёмный',
  'Drop-down flap': 'Фасад откидной',
  'Dishwasher front': 'Фасад посудомоечной машины',
  'Fridge door front': 'Фасад двери холодильника',
  'Cover panel': 'Панель торцевая',
  Filler: 'Планка-заполнитель',
  'Common top': 'Крышка общая',
  'Common bottom': 'Дно общее',
  Crown: 'Карниз',
  Pelmet: 'Планка нижняя (подсветка)',
  'Ceiling filler': 'Планка до потолка',
  'Table top': 'Столешница стола',
  Seat: 'Сиденье',
  'Seat slat': 'Рейка сиденья',
  'Table top slat': 'Рейка столешницы',
  'Front leg left': 'Ножка передняя левая',
  'Front leg right': 'Ножка передняя правая',
  'Back post left': 'Стойка спинки левая',
  'Back post right': 'Стойка спинки правая',
  'Rail front': 'Царга передняя',
  'Rail back': 'Царга задняя',
  'Rail left': 'Царга левая',
  'Rail right': 'Царга правая',
  'Stretcher front': 'Проножка передняя',
  'Stretcher back': 'Проножка задняя',
  'Stretcher left': 'Проножка левая',
  'Stretcher right': 'Проножка правая',
  'Stretcher middle': 'Проножка средняя',
  'Lower shelf': 'Полка нижняя',
  'Back panel': 'Панель спинки',
  'Back rail top': 'Перекладина спинки верхняя',
  'Back rail bottom': 'Перекладина спинки нижняя',
  'Back slat': 'Рейка спинки',
  Headboard: 'Изголовье',
  Footboard: 'Изножье',
  'Side panel': 'Панель боковая',
  'Side rail left': 'Царга боковая левая',
  'Side rail right': 'Царга боковая правая',
  'Slat ledger left': 'Брусок под ламели левый',
  'Slat ledger right': 'Брусок под ламели правый',
  Slat: 'Ламель',
  'Centre rail': 'Царга центральная',
  'Centre leg': 'Ножка центральная',
  'Guard rail left': 'Бортик левый',
  'Guard rail right': 'Бортик правый',
  'Ladder stile left': 'Тетива лестницы левая',
  'Ladder stile right': 'Тетива лестницы правая',
  'Ladder rung': 'Ступенька лестницы',
};

const isPart = (s: string): s is PartName => Object.prototype.hasOwnProperty.call(PART, s);

/**
 * "Drawer 2 side" → "Lateral sertar"; "Base cabinet: Left side" → "Base cabinet: Lateral stânga"; in Russian
 * "Боковина ящика", in English "Drawer side". Unknown labels pass through.
 */
export function partRo(label: string): string {
  const i = label.lastIndexOf(': ');
  if (i >= 0) return `${label.slice(0, i)}: ${partRo(label.slice(i + 2))}`;
  const base = baseLabel(label);
  if (!isPart(base)) return label;
  const lang = getPrintLang();
  return lang === 'ru' ? PART_RU[base] : lang === 'en' ? base : PART[base];
}

/** Drilling summary in the print language (pin rows and handle holes). */
export function drillingRo(text: string): string {
  if (!text) return '';
  return text
    .replace(
      /(\d+) rows × (\d+) holes ø(\d+), (\d+) mm from edges/g,
      pt('$1 rânduri × $2 găuri ø$3, la $4 mm de margini'),
    )
    .replace(/\(both faces, offset 16 mm\)/g, pt('(ambele fețe, decalat 16 mm)'))
    .replace(/, one face/g, pt(', o față'))
    .replace(/handle holes ø(\d+) at/g, pt('găuri mâner ø$1 la'))
    .replace(/handle hole ø(\d+) at/g, pt('gaură mâner ø$1 la'))
    .replace(/mm from left\/bottom/g, pt('mm de la stânga/jos'))
    .replace(/cut to template \((\d+) points\)/g, pt('tăiere după șablon ($1 puncte)'));
}

export function hardwareRo(h: HardwareItem): { item: string; note: string } {
  const perDoor = /^(\d+) per door/.exec(h.note ?? '')?.[1];
  switch (h.kind) {
    case 'drawer-runner-pair':
      return {
        item: pt('Pereche glisiere cu bile, montaj lateral'),
        note: pt('joc {gap} mm pe parte', {
          gap: /(\d+(?:\.\d+)?) mm/.exec(h.note ?? '')?.[1] ?? '',
        }).trim(),
      };
    case 'hinge':
      return {
        item: pt('Balama aplicată, cupă 35 mm, soft-close, clip-on'),
        note: perDoor
          ? pt('{n} pe ușă (orientativ — verificați fișa tehnică)', { n: perDoor })
          : '',
      };
    case 'clothes-rail':
      return { item: pt('Bară haine'), note: pt('tăiată la lățimea golului') };
    case 'rail-support':
      return { item: pt('Suport bară haine'), note: '' };
    case 'shelf-pin':
      return { item: pt('Suport raft (pin) ø5'), note: pt('4 pe raft mobil') };
    case 'handle': {
      const s = /(\d+) mm centres/.exec(h.label)?.[1];
      return { item: s ? pt('Mâner, {s} mm între găuri', { s }) : pt('Buton'), note: '' };
    }
    case 'push-latch':
      return {
        item: pt('Sistem push-to-open'),
        note: pt('balamale fără arc de închidere la uși'),
      };
    case 'wall-bracket':
      return {
        item: pt('Agățătoare reglabilă pentru corp suspendat'),
        note: pt(
          'câte una în colțurile de sus din spate (verificați fișa tehnică și tipul peretelui)',
        ),
      };
    case 'wall-rail':
      return {
        item: pt('Șină de perete pentru agățători'),
        note: pt('tăiată la lățimea corpului'),
      };
    case 'corner-hinge':
      return {
        item: pt('Set balama de colț (leagă cele două uși)'),
        note: pt('verificați setul și balamalele înlocuite în fișa tehnică'),
      };
    case 'wall-fixing':
      return {
        item: pt('Prindere anti-răsturnare în perete'),
        note: pt('alegeți diblurile după tipul peretelui (orientativ)'),
      };
    case 'appliance':
      return {
        item: h.label.replace(/^Built-in /, pt('Electrocasnic încorporat: ')),
        note: pt('verificați nișa după desenul de montaj al aparatului'),
      };
    case 'front-fixing':
      return {
        item: pt('Kit prindere front'),
        note: pt('de obicei livrat cu aparatul — verificați desenul de montaj'),
      };
    case 'sliding-track':
      return {
        item: pt('Șină uși glisante, sus și jos'),
        note: pt('verificați sistemul glisant în fișa tehnică'),
      };
    case 'flap-stay':
      return {
        item: pt('Mecanism clapă'),
        note: pt('alegeți după greutatea și înălțimea frontului (fișa tehnică)'),
      };
    case 'purchased':
      return { item: h.label, note: h.note ?? '' };
    case 'screws':
      return {
        item: pt('Șuruburi pentru PAL'),
        note: pt('{note} — alegeți tipul, lungimea și numărul (orientativ)', {
          note: h.note ?? '',
        }).trim(),
      };
  }
}

/** The band's material in the print language; ABS, PVC and PP read the same in every language. */
const bandKindText = (k: EdgeBandKind): string => {
  switch (k) {
    case 'abs':
      return 'ABS';
    case 'pvc':
      return 'PVC';
    case 'pp':
      return 'PP';
    case 'melamine':
      return pt('melamină');
    case 'veneer':
      return pt('furnir');
    case 'other':
      return pt('alt tip');
  }
  return k;
};

/** "ABS 0,8 × 22 mm, H1145" — the band on printed sheets and the parts CSV (ADR-077); "0.8" in English. */
export const bandRo = (b: EdgeBand) =>
  `${bandKindText(b.kind)} ${tenthsText(b.thickness, getPrintLang() === 'en' ? '.' : ',')} × ${b.width} ${pt('mm')}${b.code ? `, ${b.code}` : ''}`;

/** "cant ABS 0,8 × 22 mm · fronturi ABS 2 × 22 mm" for a board's printed header; null when nothing is banded. */
export const boardBandRo = (rows: CutRow[]) =>
  boardBandText(rows, {
    prefix: pt('cant '),
    band: bandRo,
    fronts: pt('fronturi'),
    unnamed: pt('nespecificat'),
    someUnnamed: pt('unele piese: nespecificat'),
  });

/** The CSV header in Romanian (ADR-020); `csvHeaders()` gives it in the print language. */
export const CSV_HEADERS_RO = [
  'Denumire',
  'Material',
  'Grosime',
  'Lungime',
  'Lățime',
  'Buc.',
  'Cant L',
  'Cant l',
  'Tip cant',
  'Fibră',
  'Găurire',
] as const satisfies readonly PrintKey[];

export const csvHeaders = (): string[] => CSV_HEADERS_RO.map((h) => pt(h));

/**
 * Parts CSV for panel shops: semicolon-separated (Romanian Excel's list separator), UTF-8 with BOM so
 * diacritics and Cyrillic open correctly, formula-leading cells escaped. Sizes are finished sizes (ADR-009).
 * Words in the print language (ADR-157).
 */
export function cutlistCsvRo(rows: CutRow[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [
    csvHeaders(),
    ...rows.map((r) => [
      [...new Set(r.labels.map(partRo))].join(' / '),
      r.materialName,
      r.thickness,
      r.length,
      r.width,
      r.quantity,
      r.edgesL,
      r.edgesW,
      r.edgesL || r.edgesW ? (r.band ? bandRo(r.band) : pt('nespecificat')) : '',
      r.grain ? pt('pe lungime') : pt('nu'),
      drillingRo(r.drilling),
    ]),
  ];
  return '﻿' + lines.map((l) => l.map(esc).join(';')).join('\r\n') + '\r\n';
}

import type {
  EdgeBand,
  EdgeBandKind,
  Material,
  MaterialKind,
  MaterialMaker,
  Mm,
  PanelRole,
} from './types';

/**
 * Material labels and the user's decor list (ADR-049). Labels are shown only. The decor list is the user's own
 * file: every decor comes from a row of it, nothing is filled in or guessed (ADR-010). Pure: no DOM, no storage.
 */
export const MAKERS: { value: MaterialMaker; label: string }[] = [
  { value: 'egger', label: 'Egger' },
  { value: 'kastamonu', label: 'Kastamonu' },
  { value: 'fundermax', label: 'Fundermax' },
  { value: 'kronospan', label: 'Kronospan' },
  { value: 'other', label: 'Other' },
];
export const KINDS: { value: MaterialKind; label: string }[] = [
  { value: 'pal', label: 'PAL' },
  { value: 'mdf', label: 'MDF' },
  { value: 'worktop', label: 'Kitchen worktop' },
  { value: 'other', label: 'Other' },
];
export const makerName = (v: MaterialMaker | undefined) => MAKERS.find((m) => m.value === v)?.label;
export const kindName = (v: MaterialKind | undefined) => KINDS.find((k) => k.value === v)?.label;

/** "PAL 18 white · Egger, PAL" — the name, then whichever labels are set. */
export function materialLabel(m: Pick<Material, 'name' | 'maker' | 'kind'>): string {
  const tags = [makerName(m.maker), kindName(m.kind)].filter(Boolean);
  return tags.length ? `${m.name} · ${tags.join(', ')}` : m.name;
}

/** Problems with a material's labels and decor link (design validation). */
export function materialLabelProblems(m: Record<string, unknown>): string[] {
  const errs: string[] = [];
  if (m.maker !== undefined && !MAKERS.some((x) => x.value === m.maker))
    errs.push('unknown manufacturer');
  if (m.kind !== undefined && !KINDS.some((x) => x.value === m.kind)) errs.push('unknown type');
  if (m.decor !== undefined) {
    const d = m.decor as Record<string, unknown> | null;
    if (
      !d ||
      typeof d !== 'object' ||
      typeof d.code !== 'string' ||
      !d.code ||
      typeof d.list !== 'string'
    )
      errs.push('invalid decor link');
  }
  return errs;
}

// ---------------------------------------------------------------------------
// Edge band specs (ADR-077): named by the user per board; nothing is filled in (ADR-010).
// ---------------------------------------------------------------------------

export const BAND_KINDS: { value: EdgeBandKind; label: string }[] = [
  { value: 'abs', label: 'ABS' },
  { value: 'pvc', label: 'PVC' },
  { value: 'pp', label: 'PP' },
  { value: 'melamine', label: 'Melamine' },
  { value: 'veneer', label: 'Veneer' },
  { value: 'other', label: 'Other' },
];
/** Common supplier thicknesses in tenths of a mm (0.4 · 0.8 · 1 · 2 · 3 mm): choices only, never a default. */
export const COMMON_BAND_THICKNESS = [4, 8, 10, 20, 30];
export const BAND_MAX_THICKNESS = 100;
export const BAND_MAX_WIDTH = 100;
export const BAND_MAX_ALLOWANCE = 100;
export const BAND_MAX_CODE = 60;

/** Tenths of a mm as text: 4 → "0.4", 10 → "1" (`sep` "," for Romanian output). */
export const tenthsText = (t: number, sep = '.') =>
  (t % 10 === 0 ? String(t / 10) : (t / 10).toFixed(1)).replace('.', sep);

/** "0.8" or "0,8" → 8 tenths; null when it is not a positive multiple of 0.1 mm. */
export function parseTenths(text: string): number | null {
  const s = text.trim().replace(',', '.');
  if (!/^\d+(\.\d)?$/.test(s)) return null;
  const v = Math.round(Number(s) * 10);
  return Number.isSafeInteger(v) && v >= 1 && v <= BAND_MAX_THICKNESS ? v : null;
}

const bandKindName = (k: EdgeBandKind) => BAND_KINDS.find((x) => x.value === k)?.label ?? k;

/** "ABS 0.8 × 22 mm, H1145" — the band as the shop and the buyer read it. */
export const bandText = (b: EdgeBand) =>
  `${bandKindName(b.kind)} ${tenthsText(b.thickness)} × ${b.width} mm${b.code ? `, ${b.code}` : ''}`;

/** Doors and drawer fronts may be banded differently (ADR-077). */
export const FRONT_BAND_ROLES = new Set<PanelRole>(['door', 'drawer-front']);

/** The band on a part of this board: the front band for doors and drawer fronts when set, otherwise the board's. */
export const bandFor = (m: Pick<Material, 'band' | 'frontBand'>, role: PanelRole) =>
  (FRONT_BAND_ROLES.has(role) && m.frontBand) || m.band;

/** Problems with one band spec (design validation); empty when valid. */
export function bandProblems(b: unknown): string[] {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return ['not a band spec'];
  const o = b as Record<string, unknown>;
  const whole = (v: unknown, lo: number, hi: number) =>
    typeof v === 'number' && Number.isSafeInteger(v) && v >= lo && v <= hi;
  const errs: string[] = [];
  if (!BAND_KINDS.some((k) => k.value === o.kind)) errs.push('unknown band type');
  if (!whole(o.thickness, 1, BAND_MAX_THICKNESS))
    errs.push('band thickness must be 0.1 to 10 mm, in tenths');
  if (!whole(o.width, 1, BAND_MAX_WIDTH)) errs.push('band width must be whole mm from 1 to 100');
  if (o.code !== undefined && (typeof o.code !== 'string' || o.code.length > BAND_MAX_CODE))
    errs.push('band code must be text up to 60 characters');
  if (o.allowance !== undefined && !whole(o.allowance, 0, BAND_MAX_ALLOWANCE))
    errs.push('band allowance must be whole mm from 0 to 100');
  return errs;
}

/** One row of the user's decor list. */
export interface Decor {
  /** `${maker}:${code}:${thickness}`, unique in the stored list. */
  id: string;
  maker: MaterialMaker;
  /** As written in the file. */
  makerText: string;
  kind: MaterialKind;
  code: string;
  name: string;
  thickness: Mm;
  color: string;
  /** File name it came from. */
  list: string;
}

const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
const MAKER_WORDS: Record<string, MaterialMaker> = {
  egger: 'egger',
  kastamonu: 'kastamonu',
  fundermax: 'fundermax',
  kronospan: 'kronospan',
};
const KIND_WORDS: Record<string, MaterialKind> = {
  pal: 'pal',
  pfl: 'pal',
  chipboard: 'pal',
  pal_melaminat: 'pal',
  'pal melaminat': 'pal',
  mdf: 'mdf',
  worktop: 'worktop',
  'kitchen worktop': 'worktop',
  blat: 'worktop',
  'blat bucatarie': 'worktop',
};
const HEADERS: Record<
  string,
  keyof Omit<Decor, 'id' | 'maker' | 'kind' | 'list'> | 'maker' | 'kind'
> = {
  manufacturer: 'maker',
  producer: 'maker',
  producator: 'maker',
  brand: 'maker',
  type: 'kind',
  tip: 'kind',
  code: 'code',
  cod: 'code',
  decor: 'code',
  name: 'name',
  nume: 'name',
  denumire: 'name',
  thickness: 'thickness',
  grosime: 'thickness',
  color: 'color',
  colour: 'color',
  culoare: 'color',
};
export const DECOR_COLUMNS = 'manufacturer, type, code, name, thickness, color';

/** Splits one CSV line on `sep`, honouring "quoted, fields" and "" escapes. */
function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '',
    q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Reads a decor list the user provides: CSV with a header row naming the columns manufacturer, type, code, name,
 * thickness (whole mm) and color (#rrggbb), separated by commas or semicolons (English or Romanian headers).
 * Rows with a problem are skipped and listed; never throws.
 */
export function parseDecorList(
  text: string,
  list: string,
): { decors: Decor[]; problems: string[] } {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (!lines.length) return { decors: [], problems: ['The file is empty.'] };
  const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const head = splitLine(lines[0], sep).map((h) => HEADERS[norm(h)]);
  const missing = ['maker', 'kind', 'code', 'name', 'thickness', 'color'].filter(
    (k) => !head.includes(k as never),
  );
  if (missing.length)
    return {
      decors: [],
      problems: [
        `The first row must name the columns ${DECOR_COLUMNS}; missing: ${missing.map((k) => (k === 'maker' ? 'manufacturer' : k === 'kind' ? 'type' : k)).join(', ')}.`,
      ],
    };
  const decors: Decor[] = [],
    problems: string[] = [],
    seen = new Set<string>();
  lines.slice(1).forEach((line, i) => {
    const row = i + 2;
    const cells = splitLine(line, sep);
    const get = (k: string) => cells[head.indexOf(k as never)] ?? '';
    const makerText = get('maker'),
      code = get('code'),
      name = get('name'),
      color = get('color');
    const thickness = Number(get('thickness').replace(',', '.'));
    const kind = KIND_WORDS[norm(get('kind'))] ?? 'other';
    const why = !makerText
      ? 'no manufacturer'
      : !code
        ? 'no code'
        : !name
          ? 'no name'
          : !(Number.isSafeInteger(thickness) && thickness >= 1 && thickness <= 200)
            ? `thickness "${get('thickness')}" is not whole mm from 1 to 200`
            : !/^#[0-9a-fA-F]{6}$/.test(color)
              ? `color "${color}" is not #rrggbb`
              : null;
    if (why) {
      problems.push(`Row ${row}: ${why}.`);
      return;
    }
    const maker = MAKER_WORDS[norm(makerText)] ?? 'other';
    const id = `${norm(makerText)}:${code}:${thickness}`;
    if (seen.has(id)) {
      problems.push(
        `Row ${row}: ${makerText} ${code} ${thickness} mm is listed twice; the first is kept.`,
      );
      return;
    }
    seen.add(id);
    decors.push({
      id,
      maker,
      makerText,
      kind,
      code,
      name,
      thickness,
      color: color.toLowerCase(),
      list,
    });
  });
  if (!decors.length && !problems.length) problems.push('The file has a header row but no decors.');
  return { decors, problems };
}

/** What choosing a decor sets on a board: only what the user's list says, plus where it came from. */
export const decorPatch = (d: Decor): Partial<Material> => ({
  name: `${d.makerText} ${d.code} ${d.name}`.slice(0, 200),
  thickness: d.thickness,
  color: d.color,
  maker: d.maker,
  kind: d.kind,
  decor: { code: d.code, list: d.list },
});

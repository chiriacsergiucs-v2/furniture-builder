/**
 * Fastener counts (ADR-074): how many joints, shelf pins, backs, hanging brackets, worktops and pieces on a plinth
 * the model has, counted from its panels and scheduled hardware. The app counts; it never names a screw, dowel,
 * length, spacing or load (ADR-010). What the user fixes each joint type with, and how many per joint, is the
 * user's own fastener list, saved on this device. Every line is labelled guidance.
 */
import { t } from './i18n';
import { buildModel } from './build';
import type { RunPart } from './project';
import type { ShopLine } from './shopping';
import type { Axis, Box, FurnitureModel, Mm, Panel, PanelRole } from './types';

export type JointType =
  'carcass-joint' | 'shelf-pin' | 'back-fixing' | 'hanging-point' | 'worktop-fixing' | 'foot';

export interface JointInfo {
  id: JointType;
  /** Name in the fastener list and on the Hardware tab. */
  title: string;
  /** Shopping-list name of the line ("Joint fixings: 48 joints"). */
  line: string;
  /** What is counted, singular and plural. */
  one: string;
  many: string;
  /** How it is counted, shown as guidance. */
  how: string;
}

/** Default joint types (ADR-074 open question, default list). */
export const JOINTS: JointInfo[] = [
  {
    id: 'carcass-joint',
    title: t('Carcass joint'),
    line: t('Joint fixings'),
    one: 'joint',
    many: 'joints',
    how: t(
      'each place two carcass boards meet: sides, top, bottom, dividers, fixed shelves, rails',
    ),
  },
  {
    id: 'shelf-pin',
    title: t('Shelf pin'),
    line: t('Shelf pins'),
    one: 'pin',
    many: 'pins',
    how: t('the shelf pins and supports in the hardware schedule'),
  },
  {
    id: 'back-fixing',
    title: t('Back fixing'),
    line: t('Back fixings'),
    one: 'back',
    many: 'backs',
    how: t('each back panel, fixed round its perimeter'),
  },
  {
    id: 'hanging-point',
    title: t('Hanging point'),
    line: t('Hanging point fixings'),
    one: 'bracket',
    many: 'brackets',
    how: t('each hanging bracket of a wall-hung piece'),
  },
  {
    id: 'worktop-fixing',
    title: t('Worktop fixing'),
    line: t('Worktop fixings'),
    one: 'worktop',
    many: 'worktops',
    how: t('each worktop, run or desk top'),
  },
  {
    id: 'foot',
    title: t('Foot'),
    line: t('Feet'),
    one: 'piece on a plinth',
    many: 'pieces on a plinth',
    how: t('each piece standing on a plinth'),
  },
];
export const JOINT_BY_ID = new Map(JOINTS.map((j) => [j.id, j]));

export interface FastenerCount {
  joint: JointType;
  count: number;
  /** Back perimeter or worktop length in mm, for the line's detail; 0 when not meaningful. */
  lengthMm: Mm;
}

/** The user's fastener for one joint type: their own name and how many per joint. */
export interface FastenerChoice {
  joint: JointType;
  name: string;
  /** Whole number ≥ 1. */
  per: number;
}

/** Boards that are screwed or doweled to each other in a carcass. Fronts, backs, plinths, drawer boxes and worktops are not. */
const JOINED = new Set<PanelRole>([
  'side',
  'top',
  'bottom',
  'divider',
  'shelf',
  'rail',
  'gable',
  'modesty',
]);
/** Frame furniture (ADR-038): joinery is the maker's own, not counted as carcass joints. */
const FRAME = new Set<PanelRole>([
  'leg',
  'apron',
  'stretcher',
  'slat',
  'ledger',
  'seat',
  'headboard',
  'footboard',
  'stile',
  'rung',
]);

const span = (b: Box, a: 0 | 1 | 2): [number, number] =>
  a === 0 ? [b.x, b.x + b.w] : a === 1 ? [b.y, b.y + b.h] : [b.z, b.z + b.d];

/** The axis two boxes touch on, when they meet with an area (touch on one axis, overlap on the other two). */
export function contactAxis(a: Box, b: Box): Axis | null {
  let touch: Axis | null = null;
  for (const ax of [0, 1, 2] as const) {
    const [a0, a1] = span(a, ax),
      [b0, b1] = span(b, ax);
    const overlap = Math.min(a1, b1) - Math.max(a0, b0);
    if (overlap > 0) continue;
    if (overlap < 0 || touch) return null;
    touch = AXES[ax];
  }
  return touch;
}
const AXES: Axis[] = ['x', 'y', 'z'];

/** A joint: one board's edge or face against another board's face (two edges butted together are not one). */
export const isJoint = (a: Panel, b: Panel): boolean => {
  const ax = contactAxis(a.box, b.box);
  return ax !== null && (a.thicknessAxis === ax || b.thicknessAxis === ax);
};

const perimeter = (p: Panel): Mm => {
  const [u, v] =
    p.thicknessAxis === 'x'
      ? [p.box.h, p.box.d]
      : p.thicknessAxis === 'y'
        ? [p.box.w, p.box.d]
        : [p.box.w, p.box.h];
  return 2 * (u + v);
};

/**
 * Counts for one piece (ADR-074), from its model: carcass joints are pairs of carcass boards that meet edge or face
 * to face; adjustable shelves (with scheduled shelf pins) and frame members are left out of them.
 */
export function fastenerCounts(model: FurnitureModel): FastenerCount[] {
  const pinned = new Set(model.hardware.filter((h) => h.kind === 'shelf-pin').map((h) => h.nodeId));
  // In frame furniture, rails are frame members too (ADR-038), joined by the maker's own joinery.
  const frame = model.panels.some((p) => FRAME.has(p.role));
  const joined = model.panels.filter(
    (p) =>
      JOINED.has(p.role) &&
      !(frame && p.role === 'rail') &&
      !(p.role === 'shelf' && pinned.has(p.nodeId)) &&
      !p.shape,
  );
  let joints = 0;
  for (let i = 0; i < joined.length; i++)
    for (let j = i + 1; j < joined.length; j++) if (isJoint(joined[i], joined[j])) joints++;
  const hw = (kind: string) =>
    model.hardware.reduce((n, h) => n + (h.kind === kind ? h.quantity : 0), 0);
  const backs = model.panels.filter((p) => p.role === 'back');
  const worktops = model.panels.filter((p) => p.role === 'worktop');
  return [
    { joint: 'carcass-joint', count: joints, lengthMm: 0 },
    { joint: 'shelf-pin', count: hw('shelf-pin'), lengthMm: 0 },
    {
      joint: 'back-fixing',
      count: backs.length,
      lengthMm: backs.reduce((s, p) => s + perimeter(p), 0),
    },
    { joint: 'hanging-point', count: hw('wall-bracket'), lengthMm: 0 },
    {
      joint: 'worktop-fixing',
      count: worktops.length,
      lengthMm: worktops.reduce((s, p) => s + Math.max(p.box.w, p.box.d), 0),
    },
    {
      joint: 'foot',
      count: model.panels.some((p) => p.role === 'plinth') ? 1 : 0,
      lengthMm: 0,
    },
  ];
}

/** Adds counts of the same joint type. */
export function addCounts(lists: { counts: FastenerCount[]; times: number }[]): FastenerCount[] {
  return JOINTS.map((j) => {
    let count = 0,
      lengthMm = 0;
    for (const { counts, times } of lists)
      for (const c of counts)
        if (c.joint === j.id) {
          count += c.count * times;
          lengthMm += c.lengthMm * times;
        }
    return { joint: j.id, count, lengthMm };
  });
}

/** Counts per design object, so moving one piece on the plan does not rebuild every piece. */
const cache = new WeakMap<object, FastenerCount[]>();
function designCounts(d: Parameters<typeof buildModel>[0]): FastenerCount[] {
  let c = cache.get(d);
  if (!c) cache.set(d, (c = fastenerCounts(buildModel(d))));
  return c;
}

/**
 * Counts for a whole project: each piece's own counts times its quantity, plus worktops that are run parts. A run
 * plinth replaces the pieces' own plinths, but each piece still stands on it, so feet stay counted per piece.
 */
export function projectFastenerCounts(project: {
  items: { design: Parameters<typeof buildModel>[0]; quantity: number }[];
  runParts?: RunPart[];
}): FastenerCount[] {
  const runWorktops = (project.runParts ?? []).filter((rp) => rp.kind === 'worktop');
  return addCounts([
    ...project.items.map((i) => ({
      counts: designCounts(i.design),
      times: i.quantity,
    })),
    {
      counts: [
        {
          joint: 'worktop-fixing',
          count: runWorktops.length,
          lengthMm: runWorktops.reduce((s, rp) => s + Math.max(rp.box.w, rp.box.d), 0),
        },
      ],
      times: 1,
    },
  ]);
}

const COUNTED: Record<JointType, (n: number) => string> = {
  'carcass-joint': (n) => t('{n|# joint|# joints}', { n }),
  'shelf-pin': (n) => t('{n|# pin|# pins}', { n }),
  'back-fixing': (n) => t('{n|# back|# backs}', { n }),
  'hanging-point': (n) => t('{n|# bracket|# brackets}', { n }),
  'worktop-fixing': (n) => t('{n|# worktop|# worktops}', { n }),
  foot: (n) => t('{n|# piece on a plinth|# pieces on a plinth}', { n }),
};
export const plural = (n: number, j: JointInfo) => COUNTED[j.id](n);
export const GUIDANCE = t('Guidance: counted from the model');

/** A choice the app can use: a joint type it knows, a name, a whole count per joint ≥ 1. */
export function validFastenerChoice(c: unknown): c is FastenerChoice {
  if (!c || typeof c !== 'object') return false;
  const r = c as Record<string, unknown>;
  return (
    typeof r.joint === 'string' &&
    JOINT_BY_ID.has(r.joint as JointType) &&
    typeof r.name === 'string' &&
    !!r.name.trim() &&
    typeof r.per === 'number' &&
    Number.isSafeInteger(r.per) &&
    r.per >= 1
  );
}

/**
 * Shopping-list lines for the counts (ADR-074). Without a chosen fastener a count is a line in "to choose before
 * buying"; with one it is a counted hardware line, and equal fasteners used for several joint types are combined.
 * Shelf pins are already in the hardware schedule: without a choice they stay as scheduled (no extra line); with
 * one, `replacesShelfPins` tells the list to show the user's line instead of the scheduled pins.
 */
export function fastenerShopLines(
  counts: FastenerCount[],
  choices: FastenerChoice[],
): { lines: ShopLine[]; replacesShelfPins: boolean } {
  const chosen = new Map(choices.filter(validFastenerChoice).map((c) => [c.joint, c]));
  const choose: ShopLine[] = [];
  const counted = new Map<string, ShopLine>();
  let replacesShelfPins = false;
  for (const c of counts) {
    const j = JOINT_BY_ID.get(c.joint);
    if (!j || c.count <= 0) continue;
    const pick = chosen.get(c.joint);
    const len =
      c.joint === 'back-fixing'
        ? t(', {m} m of back edge', { m: (c.lengthMm / 1000).toFixed(2) })
        : c.joint === 'worktop-fixing'
          ? t(', {m} m of worktop', { m: (c.lengthMm / 1000).toFixed(2) })
          : '';
    if (!pick) {
      if (c.joint === 'shelf-pin') continue;
      choose.push({
        section: 'choose',
        label: t('{line}: {count} — choose your fastener', {
          line: j.line,
          count: plural(c.count, j),
        }),
        quantity: c.count,
        unit: 'piece',
        detail: t('{guidance} ({how}{len}). Name yours under Materials › Fasteners.', {
          guidance: GUIDANCE,
          how: j.how,
          len,
        }),
      });
      continue;
    }
    if (c.joint === 'shelf-pin') replacesShelfPins = true;
    const name = pick.name.trim();
    const part = `${plural(c.count, j)} × ${pick.per}`;
    const cur = counted.get(name);
    if (cur) {
      cur.quantity += c.count * pick.per;
      cur.detail = cur.detail.replace(/\.$/, `; ${part}.`);
    } else
      counted.set(name, {
        section: 'hardware',
        label: name,
        quantity: c.count * pick.per,
        unit: 'piece',
        detail: `${GUIDANCE}: ${part}.`,
        priceKey: `hw:${name}`,
      });
  }
  return { lines: [...counted.values(), ...choose], replacesShelfPins };
}

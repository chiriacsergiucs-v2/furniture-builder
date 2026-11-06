/**
 * Step-by-step assembly list (ADR-174): a piece's panels ordered into steps by their role and what they touch —
 * prepare the parts, fit hardware to the sides, bottom, sides, fixed dividers and shelves, top, back, plinth,
 * adjustable shelves, drawer boxes, fronts and doors, handles, hanging, fit drawers and doors — each step with its
 * parts, the carcass joints it closes (the pairs ADR-074 counts, assigned to the later of the two panels' steps), the
 * fasteners it uses (ADR-074's counts, per step, ADR-185), the hardware scheduled on its parts (each half at the step
 * that fits it, ADR-185) and one instruction (ADR-186). The order comes from geometry and roles only: it is guidance
 * (ADR-010); the user's joints, fasteners and drilling decide. Pure.
 *
 * A project also gets an order of its pieces (ADR-178, `projectAssemblyOrder`): corner cabinets, base pieces wall by
 * wall from the corner, wall pieces, then the run parts.
 */
import { baseLabel } from './cutlist';
import {
  carcassJointPairs,
  COUNTED_PT,
  JOINT_BY_ID,
  JOINTS,
  plural,
  validFastenerChoice,
  type FastenerChoice,
  type JointType,
} from './fasteners';
import { cutDimensions } from './geometry';
import { t, tr } from './i18n';
import { pt, type PrintKey } from './i18n/print';
import { hardwareRo, partRo } from './ro';
import {
  isWallHung,
  type PlacedPiece,
  type Project,
  type ProjectModel,
  type RunPart,
} from './project';
import { NEAR_WALL, wallEnds, wallInward, type Pt, type Room } from './room';
import { insideCorner } from './roomfill';
import type { Box, Design, FurnitureModel, HardwareKind, Mm, Panel, PanelRole } from './types';
import { printPieceName } from './catalog/printName';

export type StepId =
  | 'prepare'
  | 'fit-hardware'
  | 'bottom'
  | 'sides'
  | 'fixed'
  | 'top'
  | 'back'
  | 'plinth'
  | 'adjustable'
  | 'drawers'
  | 'fronts'
  | 'handles'
  | 'hang'
  | 'fit'
  | 'loose'
  | 'also';

export interface StepPart {
  /** Panel ids of the model (one entry per identical part; in a drawer box group, every box's). */
  panelIds: string[];
  /** The part's name as the generators give it, without its number ("Drawer side"); `partName()` shows it. */
  label: string;
  role: PanelRole;
  /** How many (per box in a drawer box group). */
  quantity: number;
  /** Finished size, mm: length × width × thickness. */
  size: [number, number, number];
}

/** Identical drawer boxes listed once (ADR-186): one box's parts, and how many boxes. */
export interface StepBox {
  times: number;
  parts: StepPart[];
}

/** Which half of a two-part hardware item a step fits (ADR-185). */
export type HardwareHalf = 'carcass' | 'drawer' | 'plate' | 'door';

export interface StepHardware {
  kind: HardwareKind;
  label: string;
  quantity: number;
  note?: string;
  sizeMm?: Mm;
  /** Absent: the whole item. Runner pairs: carcass or drawer half; hinges: mounting plate or door half. */
  half?: HardwareHalf;
}

/** The fasteners of one joint type a step uses (ADR-185, counted by ADR-074's rules). */
export interface StepFastener {
  joint: JointType;
  count: number;
}

/** What the Prepare step lists (ADR-186): only what the model holds — no depth or position is added (ADR-010). */
export type PrepItem =
  | { kind: 'band'; part: StepPart; long: number; short: number }
  | { kind: 'cups'; count: number; hinge: StepHardware }
  | { kind: 'pins'; count: number; panelIds: string[] };

export interface AssemblyStep {
  id: StepId;
  /** Step number from 1, in order. */
  n: number;
  title: string;
  /** The parts fixed in this step (every panel is in exactly one step's `parts` or `boxes`). */
  parts: StepPart[];
  /** Drawer boxes, identical ones once (ADR-186). */
  boxes: StepBox[];
  /** Parts fixed earlier that this step works on again: the doors and drawer fronts hung and adjusted (ADR-185). */
  again: StepPart[];
  /** The Prepare step's edges to band, hinge cups and shelf-pin rows (ADR-186). */
  prep: PrepItem[];
  /** Carcass joints this step closes (ADR-074's pairs). */
  joints: number;
  /** Fasteners per joint type this step uses; over the steps they add up to `fastenerCounts()`. */
  fasteners: StepFastener[];
  hardware: StepHardware[];
}

export const STEP_ORDER: StepId[] = [
  'prepare',
  'fit-hardware',
  'bottom',
  'sides',
  'fixed',
  'top',
  'back',
  'plinth',
  'adjustable',
  'drawers',
  'fronts',
  'handles',
  'hang',
  'fit',
  'loose',
  'also',
];

/** Step titles: the `t()` keys shown on the tab; the printed sheet uses `pt()` with the same meaning. */
export const STEP_TITLE: Record<StepId, string> = {
  prepare: t('Prepare the parts'),
  'fit-hardware': t('Fit hardware to the sides'),
  bottom: t('Bottom'),
  sides: t('Sides to the bottom'),
  fixed: t('Fixed dividers and shelves'),
  top: t('Top'),
  back: t('Back'),
  plinth: t('Plinth'),
  adjustable: t('Adjustable shelves'),
  drawers: t('Drawer boxes'),
  fronts: t('Doors and fronts'),
  handles: t('Handles'),
  hang: t('Hanging and fixing'),
  fit: t('Fit drawers and doors, adjust the fronts'),
  loose: t('Loose parts'),
  also: t('Also'),
};

/** Step titles as print text keys (Romanian, ADR-020/157). */
const STEP_PT: Record<StepId, PrintKey> = {
  prepare: 'Pregătirea pieselor',
  'fit-hardware': 'Feroneria pe laterale',
  bottom: 'Fundul',
  sides: 'Laturile pe fund',
  fixed: 'Despărțitoare și polițe fixe',
  top: 'Capacul',
  back: 'Spatele',
  plinth: 'Soclul',
  adjustable: 'Polițe reglabile',
  drawers: 'Corpuri de sertar',
  fronts: 'Uși și fronturi',
  handles: 'Mânere',
  hang: 'Prindere și fixare',
  fit: 'Montarea sertarelor și ușilor, reglarea fronturilor',
  loose: 'Piese libere',
  also: 'De asemenea',
};

/** The line every list and sheet carries (ADR-010). */
export const ASSEMBLY_GUIDANCE = t(
  "Guidance: order from the parts' positions; your joints, fasteners and drilling decide.",
);

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
const DRAWER = new Set<PanelRole>([
  'drawer-side',
  'drawer-back',
  'drawer-inner-front',
  'drawer-bottom',
]);
const FRONT = new Set<PanelRole>(['door', 'drawer-front', 'blind-panel']);
/** Fronts that are hung and adjusted at the end (ADR-185). */
const HUNG = new Set<PanelRole>(['door', 'drawer-front']);
/** Hanging hardware: what a wall piece hangs on. */
const HANGING = new Set<HardwareKind>(['wall-bracket', 'wall-rail', 'wall-hanging']);

/** Hardware kinds by the step that fits them; the rest goes to "Hanging and fixing". */
const HW_STEP: Partial<Record<HardwareKind, StepId>> = {
  'shelf-pin': 'adjustable',
  'drawer-runner-pair': 'drawers',
  hinge: 'fronts',
  'corner-hinge': 'fronts',
  'front-fixing': 'fronts',
  'flap-stay': 'fronts',
  'push-latch': 'fronts',
  'sliding-track': 'fronts',
  handle: 'handles',
};

/** The other half of runner pairs and hinges, fitted to the sides before the carcass is closed (ADR-185). */
const SIDE_HALF: Partial<Record<HardwareKind, [HardwareHalf, HardwareHalf]>> = {
  'drawer-runner-pair': ['carcass', 'drawer'],
  hinge: ['plate', 'door'],
};

function stepOf(p: Panel, pinned: Set<string>, loose: boolean): StepId {
  if (loose) return 'loose';
  switch (p.role) {
    case 'bottom':
      return 'bottom';
    case 'side':
    case 'gable':
      return 'sides';
    case 'divider':
    case 'modesty':
      return 'fixed';
    case 'shelf':
      return pinned.has(p.nodeId) ? 'adjustable' : 'fixed';
    case 'top':
    case 'rail':
    case 'worktop':
      return 'top';
    case 'back':
      return 'back';
    case 'plinth':
      return 'plinth';
    default:
      if (DRAWER.has(p.role)) return 'drawers';
      if (FRONT.has(p.role)) return 'fronts';
      if (p.role === 'loose' || FRAME.has(p.role)) return 'loose';
      return 'also';
  }
}

const size = (p: Panel): [number, number, number] => {
  const dims = [p.box.w, p.box.h, p.box.d];
  const thick = p.thicknessAxis === 'x' ? 0 : p.thicknessAxis === 'y' ? 1 : 2;
  const [a, b] = dims.filter((_, i) => i !== thick).sort((x, y) => y - x);
  return [a, b, dims[thick]];
};

/** Identical parts once: the same name (without its number), size and board. */
function groupParts(panels: Panel[]): StepPart[] {
  const parts = new Map<string, StepPart>();
  for (const p of panels) {
    const sz = size(p);
    const label = baseLabel(p.label);
    const key = `${label}|${sz.join('x')}|${p.materialId}`;
    const part = parts.get(key);
    if (part) {
      part.panelIds.push(p.id);
      part.quantity++;
    } else parts.set(key, { panelIds: [p.id], label, role: p.role, quantity: 1, size: sz });
  }
  return [...parts.values()];
}

/** Drawer boxes (ADR-186): each box's parts; boxes with the same parts and sizes once, "Drawer box × N". */
function groupBoxes(panels: Panel[]): StepBox[] {
  const boxes = new Map<string, Panel[]>();
  for (const p of panels) {
    const k = `${p.nodeId}|${/^Drawer (\d+)\b/.exec(p.label)?.[1] ?? ''}`;
    boxes.set(k, [...(boxes.get(k) ?? []), p]);
  }
  const same = new Map<string, StepBox>();
  const out: StepBox[] = [];
  for (const list of boxes.values()) {
    const parts = groupParts(list);
    const sig = parts.map((x) => `${x.label}|${x.size.join('x')}|${x.quantity}`).join(';');
    const sigMat = `${sig}|${list.map((p) => p.materialId).join(',')}`;
    const have = same.get(sigMat);
    if (have) {
      have.times++;
      have.parts.forEach((x, i) => x.panelIds.push(...parts[i].panelIds));
      continue;
    }
    const box: StepBox = { times: 1, parts };
    same.set(sigMat, box);
    out.push(box);
  }
  return out;
}

/** Equal hardware lines of a step once, quantities added. */
function groupHardware(items: StepHardware[]): StepHardware[] {
  const out = new Map<string, StepHardware>();
  for (const h of items) {
    const key = `${h.kind}|${h.label}|${h.half ?? ''}`;
    const have = out.get(key);
    if (have) have.quantity += h.quantity;
    else out.set(key, { ...h });
  }
  return [...out.values()];
}

/** The panels a step fixes (its parts and drawer boxes); over the steps, every panel once. */
export const stepPanelIds = (s: AssemblyStep): string[] => [
  ...s.parts.flatMap((p) => p.panelIds),
  ...s.boxes.flatMap((b) => b.parts.flatMap((p) => p.panelIds)),
];

/** The panels Show step lights: the step's own, the parts it works on again and the parts it prepares. */
export const stepLitIds = (s: AssemblyStep): string[] => [
  ...stepPanelIds(s),
  ...s.again.flatMap((p) => p.panelIds),
  ...s.prep.flatMap((x) =>
    x.kind === 'band' ? x.part.panelIds : x.kind === 'pins' ? x.panelIds : [],
  ),
];

/** The steps for one piece's model; every panel is in exactly one step, every scheduled hardware item too. */
export function assemblySteps(model: FurnitureModel): AssemblyStep[] {
  const pinned = new Set(model.hardware.filter((h) => h.kind === 'shelf-pin').map((h) => h.nodeId));
  // A panel set (ADR-041) or frame furniture (ADR-038): one step, no order claimed.
  const loose = model.panels.some((p) => p.role === 'loose' || FRAME.has(p.role));
  const byStep = new Map<StepId, Panel[]>();
  const stepOfId = new Map<string, StepId>();
  for (const p of model.panels) {
    const s = stepOf(p, pinned, loose);
    stepOfId.set(p.id, s);
    byStep.set(s, [...(byStep.get(s) ?? []), p]);
  }
  // Fasteners per step (ADR-185), by ADR-074's rules: each joint type counted where its parts are fixed.
  const fast = new Map<StepId, Map<JointType, number>>();
  const addFast = (s: StepId, j: JointType, n: number) => {
    const m = fast.get(s) ?? new Map<JointType, number>();
    m.set(j, (m.get(j) ?? 0) + n);
    fast.set(s, m);
  };
  // Joints: each carcass pair counts in the later of its two panels' steps.
  const joints = new Map<StepId, number>();
  for (const [a, b] of carcassJointPairs(model)) {
    const sa = STEP_ORDER.indexOf(stepOfId.get(a.id) ?? 'also'),
      sb = STEP_ORDER.indexOf(stepOfId.get(b.id) ?? 'also');
    const s = STEP_ORDER[Math.max(sa, sb)];
    joints.set(s, (joints.get(s) ?? 0) + 1);
    addFast(s, 'carcass-joint', 1);
  }
  for (const p of model.panels) {
    if (p.role === 'back') addFast(stepOfId.get(p.id)!, 'back-fixing', 1);
    if (p.role === 'worktop') addFast(stepOfId.get(p.id)!, 'worktop-fixing', 1);
  }
  const plinth = model.panels.find((p) => p.role === 'plinth');
  if (plinth) addFast(stepOfId.get(plinth.id)!, 'foot', 1);
  // Hardware: each item at the step that fits it; runner pairs and hinges also fit their other half to the sides.
  const hw = new Map<StepId, StepHardware[]>();
  const addHw = (s: StepId, h: StepHardware) => hw.set(s, [...(hw.get(s) ?? []), h]);
  for (const h of model.hardware) {
    const s = HW_STEP[h.kind] ?? 'hang';
    const halves = loose ? undefined : SIDE_HALF[h.kind];
    const item: StepHardware = {
      kind: h.kind,
      label: h.label,
      quantity: h.quantity,
      ...(h.note ? { note: h.note } : {}),
      ...(h.sizeMm ? { sizeMm: h.sizeMm } : {}),
    };
    if (halves) {
      addHw('fit-hardware', { ...item, half: halves[0] });
      addHw(s, { ...item, half: halves[1] });
    } else addHw(s, item);
    if (h.kind === 'shelf-pin') addFast(s, 'shelf-pin', h.quantity);
    if (h.kind === 'wall-bracket') addFast(s, 'hanging-point', h.quantity);
  }
  // Prepare (ADR-186): edges to band, hinge cups to drill, sides with shelf-pin rows — what the model holds.
  const prep: PrepItem[] = [];
  const banded = new Map<string, Extract<PrepItem, { kind: 'band' }>>();
  for (const p of model.panels) {
    const c = cutDimensions(p, false);
    if (!c.edgesL && !c.edgesW) continue;
    const [part] = groupParts([p]);
    const key = `${part.label}|${part.size.join('x')}|${p.materialId}|${c.edgesL}|${c.edgesW}`;
    const have = banded.get(key);
    if (have) {
      have.part.panelIds.push(p.id);
      have.part.quantity++;
    } else banded.set(key, { kind: 'band', part, long: c.edgesL, short: c.edgesW });
  }
  prep.push(...banded.values());
  for (const h of groupHardware(
    model.hardware
      .filter((h) => h.kind === 'hinge')
      .map((h) => ({
        kind: h.kind,
        label: h.label,
        quantity: h.quantity,
        ...(h.note ? { note: h.note } : {}),
      })),
  ))
    prep.push({ kind: 'cups', count: h.quantity, hinge: h });
  const rows = model.panels.filter((p) => p.pinRows?.length);
  if (rows.length) prep.push({ kind: 'pins', count: rows.length, panelIds: rows.map((p) => p.id) });
  // Fit (ADR-185): the doors and drawer fronts hung and adjusted last.
  const again = loose ? [] : groupParts(model.panels.filter((p) => HUNG.has(p.role)));

  const steps: AssemblyStep[] = [];
  for (const id of STEP_ORDER) {
    const panels = byStep.get(id) ?? [];
    const items = hw.get(id) ?? [];
    const f = fast.get(id);
    const step: AssemblyStep = {
      id,
      n: steps.length + 1,
      title: STEP_TITLE[id],
      parts: id === 'drawers' ? [] : groupParts(panels),
      boxes: id === 'drawers' ? groupBoxes(panels) : [],
      again: id === 'fit' ? again : [],
      prep: id === 'prepare' ? prep : [],
      joints: joints.get(id) ?? 0,
      fasteners: JOINTS.flatMap((j) => {
        const count = f?.get(j.id) ?? 0;
        return count ? [{ joint: j.id, count }] : [];
      }),
      hardware: groupHardware(items),
    };
    const empty =
      !panels.length &&
      !step.hardware.length &&
      !step.joints &&
      !step.fasteners.length &&
      !step.again.length &&
      !step.prep.length;
    if (!empty) steps.push(step);
  }
  return steps;
}

// ---------------------------------------------------------------------------
// The words of a step, on the tab (app language, `t`/`tr`) and on the printed sheet (print language, `pt`)
// ---------------------------------------------------------------------------

/** 'app': the tab, in the app language (ADR-153); 'print': the sheet, in the print language (ADR-157). */
export type Words = 'app' | 'print';

/** A part's name: `tr()` on the tab, `partRo()` on the sheet. */
export const partName = (label: string, w: Words): string =>
  w === 'print' ? partRo(label) : tr(label);

/** A hardware line's name: as the schedule names it on the tab, as the printed hardware list names it on the sheet. */
export const hardwareName = (h: StepHardware, w: Words): string =>
  w === 'print' ? hardwareRo(h).item : tr(h.label);

/** The step's title. */
export const stepTitle = (s: AssemblyStep, w: Words): string =>
  w === 'print' ? pt(STEP_PT[s.id]) : s.title;

/** "Drawer box × 4". */
export const boxTitle = (b: StepBox, w: Words): string =>
  w === 'print'
    ? pt('Corp de sertar × {n}', { n: b.times })
    : t('Drawer box × {n}', { n: b.times });

const HALF_APP: Record<HardwareHalf, string> = {
  carcass: t('carcass halves'),
  drawer: t('drawer halves'),
  plate: t('mounting plates'),
  door: t('cups and arms, on the doors'),
};
const HALF_PT: Record<HardwareHalf, PrintKey> = {
  carcass: 'jumătățile de corp',
  drawer: 'jumătățile de sertar',
  plate: 'plăcuțe de montaj',
  door: 'cupe și brațe, pe uși',
};

/** "4 × Ball-bearing side runner pair — carcass halves". */
export function hardwareLine(h: StepHardware, w: Words): string {
  const half = h.half ? ` — ${w === 'print' ? pt(HALF_PT[h.half]) : HALF_APP[h.half]}` : '';
  return `${h.quantity} × ${hardwareName(h, w)}${half}`;
}

const counted = (j: JointType, n: number, w: Words) =>
  w === 'print' ? pt(COUNTED_PT[j], { n }) : plural(n, JOINT_BY_ID.get(j)!);

/**
 * The step's fastener lines (ADR-185): with the user's fastener for the joint type "8 × Confirmat 7 × 50 (4 joints ×
 * 2)"; without one "4 joints — choose your fastener (Settings › Fasteners)". Shelf pins without a chosen fastener
 * are the scheduled pins already listed under hardware (as on the shopping list, ADR-074), so no line.
 */
export function fastenerLines(s: AssemblyStep, choices: FastenerChoice[], w: Words): string[] {
  const chosen = new Map(choices.filter(validFastenerChoice).map((c) => [c.joint, c]));
  const out: string[] = [];
  for (const f of s.fasteners) {
    const c = chosen.get(f.joint);
    const what = counted(f.joint, f.count, w);
    if (c) out.push(`${f.count * c.per} × ${c.name.trim()} (${what} × ${c.per})`);
    else if (f.joint !== 'shelf-pin')
      out.push(
        w === 'print'
          ? pt('{count} — alegeți elementul de fixare ({path})', {
              count: what,
              // The menu's name in the print language (user 2026-11-05: a print never mixes languages).
              path: pt('Setări › Elemente de fixare'),
            })
          : t('{count} — choose your fastener ({path})', {
              count: what,
              path: t('Settings › Fasteners'),
            }),
      );
  }
  return out;
}

/** The Prepare step's lines: "2 × Left side — band 1 long edge", "Hinge cups to drill: 2 — …", shelf-pin rows. */
export function prepLines(s: AssemblyStep, w: Words): string[] {
  const p = w === 'print';
  const mm = p ? pt('mm') : t('mm');
  return s.prep.map((x) => {
    if (x.kind === 'band') {
      const edges = [
        x.long
          ? p
            ? pt('{n|# latură lungă|# laturi lungi}', { n: x.long })
            : t('{n|# long edge|# long edges}', { n: x.long })
          : '',
        x.short
          ? p
            ? pt('{n|# latură scurtă|# laturi scurte}', { n: x.short })
            : t('{n|# short edge|# short edges}', { n: x.short })
          : '',
      ].filter(Boolean);
      const band = p
        ? pt('cant pe {what}', { what: joinList(edges, w) })
        : t('band {what}', { what: joinList(edges, w) });
      const sz = `${x.part.size[0]} × ${x.part.size[1]} × ${x.part.size[2]} ${mm}`;
      return `${x.part.quantity} × ${partName(x.part.label, w)} ${sz} — ${band}`;
    }
    if (x.kind === 'cups')
      return p
        ? pt('Cupe de balama de găurit: {n} — {hinge}', {
            n: x.count,
            hinge: hardwareName(x.hinge, w),
          })
        : t('Hinge cups to drill: {n} — {hinge}', { n: x.count, hinge: hardwareName(x.hinge, w) });
    return p
      ? pt('Rânduri pentru suporți de raft de găurit: {n|# piesă|# piese}', { n: x.count })
      : t('Shelf-pin rows to drill: {n|# panel|# panels}', { n: x.count });
  });
}

/** "a, b and c" in the words' language. */
function joinList(items: string[], w: Words): string {
  if (items.length < 2) return items[0] ?? '';
  const and = w === 'print' ? pt(' și ') : t(' and ');
  return items.slice(0, -1).join(', ') + and + items[items.length - 1];
}
const lowerFirst = (s: string) => s.charAt(0).toLocaleLowerCase() + s.slice(1);
const upperFirst = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/** The step's parts as a phrase: "left side and right side", "shelf × 3". */
function partsPhrase(parts: StepPart[], w: Words): string {
  return joinList(
    parts.map(
      (x) => `${lowerFirst(partName(x.label, w))}${x.quantity > 1 ? ` × ${x.quantity}` : ''}`,
    ),
    w,
  );
}

/**
 * One short instruction per step (ADR-186), built from the step and its parts, e.g. "Fix the left side and right
 * side to the bottom (2 joints)." The Back step checks the carcass is square first. Guidance (ADR-010): what to do,
 * never with what screw or where to drill.
 */
export function stepInstruction(s: AssemblyStep, w: Words): string {
  const p = w === 'print';
  const parts = partsPhrase(s.parts, w);
  const j = s.joints
    ? p
      ? pt(' ({n|# îmbinare|# îmbinări})', { n: s.joints })
      : t(' ({n|# joint|# joints})', { n: s.joints })
    : '';
  const has = (k: HardwareKind) => s.hardware.some((h) => h.kind === k);
  const sentence = (clauses: string[]) => `${upperFirst(joinList(clauses, w))}.`;
  switch (s.id) {
    case 'prepare': {
      const band = s.prep.reduce((n, x) => n + (x.kind === 'band' ? x.part.quantity : 0), 0);
      const cups = s.prep.reduce((n, x) => n + (x.kind === 'cups' ? x.count : 0), 0);
      const pins = s.prep.find((x) => x.kind === 'pins')?.count ?? 0;
      const what = [
        band
          ? p
            ? pt('cantuiți muchiile la {n|# piesă|# piese}', { n: band })
            : t('band the edges of {n|# part|# parts}', { n: band })
          : '',
        cups
          ? p
            ? pt('găuriți {n|# cupă de balama|# cupe de balama}', { n: cups })
            : t('drill {n|# hinge cup|# hinge cups}', { n: cups })
          : '',
        pins
          ? p
            ? pt('găuriți rândurile pentru suporți de raft în {n|# piesă|# piese}', { n: pins })
            : t('drill the shelf-pin rows in {n|# panel|# panels}', { n: pins })
          : '',
      ].filter(Boolean);
      return p
        ? pt('Înainte de asamblare: {what}.', { what: joinList(what, w) })
        : t('Before assembly: {what}.', { what: joinList(what, w) });
    }
    case 'fit-hardware': {
      const runners = s.hardware
        .filter((h) => h.kind === 'drawer-runner-pair')
        .reduce((n, h) => n + h.quantity, 0);
      const hinges = s.hardware
        .filter((h) => h.kind === 'hinge')
        .reduce((n, h) => n + h.quantity, 0);
      const what = [
        runners
          ? p
            ? pt('jumătățile de corp ale glisierelor ({n|# pereche|# perechi})', { n: runners })
            : t('the carcass halves of the runners ({n|# pair|# pairs})', { n: runners })
          : '',
        hinges
          ? p
            ? pt('plăcuțele de montaj ale balamalelor ({n})', { n: hinges })
            : t('the hinge mounting plates ({n})', { n: hinges })
          : '',
      ].filter(Boolean);
      return p
        ? pt('Fixați {what} pe laterale cât stau culcate.', { what: joinList(what, w) })
        : t('Fix {what} to the sides while they lie flat.', { what: joinList(what, w) });
    }
    case 'bottom':
      return p
        ? pt('Așezați pe o suprafață plană, cu fața interioară în sus: {parts}.', { parts })
        : t('Lay the {parts} on a flat surface, inside face up.', { parts });
    case 'sides':
      return p
        ? pt('Fixați pe bază: {parts}{joints}.', { parts, joints: j })
        : t('Fix the {parts} to the bottom{joints}.', { parts, joints: j });
    case 'fixed':
      return p
        ? pt('Fixați între laterale: {parts}{joints}.', { parts, joints: j })
        : t('Fix the {parts} between the sides{joints}.', { parts, joints: j });
    case 'top':
      return p
        ? pt('Fixați deasupra lateralelor: {parts}{joints}.', { parts, joints: j })
        : t('Fix the {parts} on top of the sides{joints}.', { parts, joints: j });
    case 'back': {
      const square = p
        ? pt('Verificați că corpul este în echer (diagonale egale) înainte de a fixa spatele.')
        : t('Check the carcass is square (equal diagonals) before fixing the back.');
      const fix = p
        ? pt('Apoi fixați pe corp: {parts}{joints}.', { parts, joints: j })
        : t('Then fix the {parts} to the carcass{joints}.', { parts, joints: j });
      return `${square} ${fix}`;
    }
    case 'plinth':
      return p
        ? pt('Fixați sub corp: {parts}{joints}.', { parts, joints: j })
        : t('Fix the {parts} under the carcass{joints}.', { parts, joints: j });
    case 'adjustable':
      return p
        ? pt('Puneți suporții de raft la înălțimile dorite și așezați pe ei: {parts}.', { parts })
        : t('Set the shelf pins at the heights you want and lay the {parts} on them.', { parts });
    case 'drawers': {
      const n = s.boxes.reduce((k, b) => k + b.times, 0);
      if (has('drawer-runner-pair'))
        return p
          ? pt(
              'Asamblați {n|# corp de sertar|# corpuri de sertar} și fixați jumătățile de sertar ale glisierelor pe laterale.',
              { n },
            )
          : t(
              'Assemble {n|# drawer box|# drawer boxes} and fix the drawer halves of the runners to their sides.',
              { n },
            );
      return p
        ? pt('Asamblați {n|# corp de sertar|# corpuri de sertar}.', { n })
        : t('Assemble {n|# drawer box|# drawer boxes}.', { n });
    }
    case 'fronts': {
      const doors = s.parts.some((x) => x.role === 'door');
      const fronts = s.parts.some((x) => x.role === 'drawer-front');
      const other = s.parts.filter((x) => !HUNG.has(x.role));
      const what = [
        doors
          ? has('hinge')
            ? p
              ? pt('montați balamalele pe uși')
              : t('fit the hinges to the doors')
            : p
              ? pt('pregătiți ușile pentru montaj')
              : t('get the doors ready to fit')
          : '',
        fronts
          ? p
            ? pt('fixați fronturile pe corpurile de sertar')
            : t('fix the fronts to the drawer boxes')
          : '',
        other.length
          ? p
            ? pt('fixați: {parts}', { parts: partsPhrase(other, w) })
            : t('fix the {parts}', { parts: partsPhrase(other, w) })
          : '',
      ].filter(Boolean);
      if (!what.length)
        what.push(p ? pt('montați feroneria de aici') : t('fit the hardware listed here'));
      return sentence(what);
    }
    case 'handles':
      return p ? pt('Fixați mânerele pe fronturi.') : t('Fix the handles to the fronts.');
    case 'hang': {
      const hang = s.hardware.some((h) => HANGING.has(h.kind));
      const rest = s.hardware.some((h) => !HANGING.has(h.kind)) || s.parts.length > 0;
      const what = [
        hang ? (p ? pt('agățați corpul pe agățători') : t('hang the piece on its brackets')) : '',
        rest || !hang
          ? p
            ? pt('montați feroneria de aici')
            : t('fit the hardware listed here')
          : '',
      ].filter(Boolean);
      return sentence(what);
    }
    case 'fit': {
      const doors = s.again.some((x) => x.role === 'door');
      const drawers = s.again.some((x) => x.role === 'drawer-front');
      const what = [
        doors ? (p ? pt('agățați ușile') : t('hang the doors')) : '',
        drawers ? (p ? pt('introduceți sertarele') : t('slide the drawers in')) : '',
        p
          ? pt('reglați fronturile până când rosturile sunt egale')
          : t('adjust the fronts until the gaps are even'),
      ].filter(Boolean);
      return sentence(what);
    }
    case 'loose':
      return p
        ? pt('Îmbinați piesele după cum decideți; nu se propune o ordine.')
        : t('Join the parts as your own design decides; no order is claimed.');
    case 'also':
      return p ? pt('Montați aceste piese la locul lor.') : t('Fit these parts where they belong.');
  }
}
// ---------------------------------------------------------------------------
// Project assembly order (ADR-178): which piece goes in first
// ---------------------------------------------------------------------------

export type ProjectStageId = 'corners' | 'base' | 'wall' | 'run';

export const PROJECT_STAGE_ORDER: ProjectStageId[] = ['corners', 'base', 'wall', 'run'];

/** Stage titles: the `t()` keys shown on the tab; the printed sheet uses `pt()` with the same meaning. */
export const PROJECT_STAGE_TITLE: Record<ProjectStageId, string> = {
  corners: t('Corner cabinets'),
  base: t('Base pieces'),
  wall: t('Wall pieces'),
  run: t('Run parts'),
};

/** One line of a stage: a piece (linked copies once), run parts, a common top or bottom, or a sink cut-out. */
export interface OrderEntry {
  kind: 'piece' | RunPart['kind'] | 'common' | 'sink';
  /** Item ids for a piece, run part ids, common panel node ids (`common:<id>`) or sink ids. */
  ids: string[];
  /** The piece's name, or the part's label as the generators name it (English: `tr()` / `partRo()` to show). */
  name: string;
  /** A piece's design, for its name on the print (`printPieceName`, ADR-202). */
  design?: Pick<Design, 'name' | 'catalog'>;
  /** Copies of a piece and its linked copies (ADR-111), or identical run parts: how many this line stands for. */
  times: number;
  /** The wall (from 0) the piece's back stands on; absent = on no wall, or no room. */
  wall?: number;
  /** A sink cut-out's width and depth, mm. */
  size?: [Mm, Mm];
}

export interface ProjectStage {
  id: ProjectStageId;
  /** Stage number from 1, in order. */
  n: number;
  title: string;
  entries: OrderEntry[];
}

/** Run parts in the order they go on: plinths, fillers and covers, cornices, worktops (then common panels, sinks). */
const RUN_RANK: Record<RunPart['kind'], number> = {
  plinth: 0,
  filler: 1,
  cover: 1,
  crown: 2,
  pelmet: 2,
  'ceiling-filler': 2,
  worktop: 3,
};

/** The wall whose line the piece's back stands on (within `NEAR_WALL`), its front facing into the room. */
function wallOf(room: Room, pc: PlacedPiece): number | undefined {
  const b = pc.bounds;
  let best: { i: number; gap: number } | undefined;
  for (let i = 0; i < room.outline.length; i++) {
    const [a, e] = wallEnds(room, i);
    const [nx, nz] = wallInward(room, i);
    let gap: number;
    if (a[1] === e[1] && nz !== 0) {
      if (pc.facing.axis !== 'z' || pc.facing.sign !== nz) continue;
      const lo = Math.min(a[0], e[0]),
        hi = Math.max(a[0], e[0]);
      if (!(b.x < hi && b.x + b.w > lo)) continue;
      gap = Math.abs((nz > 0 ? b.z : b.z + b.d) - a[1]);
    } else if (a[0] === e[0] && nx !== 0) {
      if (pc.facing.axis !== 'x' || pc.facing.sign !== nx) continue;
      const lo = Math.min(a[1], e[1]),
        hi = Math.max(a[1], e[1]);
      if (!(b.z < hi && b.z + b.d > lo)) continue;
      gap = Math.abs((nx > 0 ? b.x : b.x + b.w) - a[0]);
    } else continue;
    if (gap <= NEAR_WALL && (!best || gap < best.gap)) best = { i, gap };
  }
  return best?.i;
}

/** How far a box is from a point on the plan (0 when the point is on or inside it). */
const planGap = (b: Box, p: Pt) =>
  Math.max(b.x - p[0], 0, p[0] - (b.x + b.w)) + Math.max(b.z - p[1], 0, p[1] - (b.z + b.d));

/**
 * The end of wall `i` its pieces start from: the end with a corner cabinet; else the inside corner it shares with a
 * wall that has pieces of the same stage; else its start.
 */
function cornerEnd(
  room: Room,
  i: number,
  corners: PlacedPiece[],
  usedWalls: Set<number>,
): 'start' | 'end' {
  const n = room.outline.length;
  const [a, e] = wallEnds(room, i);
  if (corners.some((c) => planGap(c.bounds, a) <= NEAR_WALL)) return 'start';
  if (corners.some((c) => planGap(c.bounds, e) <= NEAR_WALL)) return 'end';
  const prev = (i - 1 + n) % n,
    next = (i + 1) % n;
  if (usedWalls.has(prev) && insideCorner(room, prev)) return 'start';
  if (usedWalls.has(next) && insideCorner(room, i)) return 'end';
  return 'start';
}

/** How far along wall `i` the piece starts, measured from the chosen end. */
function alongFrom(room: Room, i: number, from: 'start' | 'end', b: Box): number {
  const [a, e] = wallEnds(room, i);
  const [p, q] = from === 'start' ? [a, e] : [e, a];
  if (a[1] === e[1]) return q[0] > p[0] ? b.x - p[0] : p[0] - (b.x + b.w);
  return q[1] > p[1] ? b.z - p[1] : p[1] - (b.z + b.d);
}

/** On the floor (base stage), or not (wall stage): hung on the wall, on or above another piece, or lifted. */
const onFloor = (pc: PlacedPiece) => {
  const pl = pc.item.placement;
  if (pl?.kind === 'wall' || pl?.kind === 'above' || isWallHung(pc.item.design)) return false;
  return pc.bounds.y <= 0;
};

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The project's assembly order (ADR-178): corner cabinets first, then the base pieces wall by wall (room wall order,
 * each wall from its corner end), then the wall pieces in the same order, then the run parts (plinths, fillers and
 * covers, cornices, worktops, common tops and bottoms, sinks). Pieces on no wall — every piece of a project without a
 * room — follow by plan x, then z. Linked copies are listed once with their count. Guidance from geometry only
 * (ADR-010). Pure and deterministic: the same project gives the same order. Empty stages are left out; no project
 * (a design alone), no stages.
 */
export function projectAssemblyOrder(
  project: Project | null | undefined,
  model: ProjectModel | null | undefined,
): ProjectStage[] {
  if (!project || !model) return [];
  const room = project.room && project.room.outline.length >= 3 ? project.room : undefined;
  const index = new Map(model.pieces.map((pc, k) => [pc.item.id, k]));
  const wall = new Map<string, number | undefined>(
    model.pieces.map((pc) => [pc.item.id, room ? wallOf(room, pc) : undefined]),
  );
  const byPlan = (a: PlacedPiece, b: PlacedPiece) =>
    a.bounds.x - b.bounds.x ||
    a.bounds.z - b.bounds.z ||
    index.get(a.item.id)! - index.get(b.item.id)!;
  const corners = model.pieces.filter((pc) => pc.item.design.product.kind === 'corner');
  const rest = model.pieces.filter((pc) => pc.item.design.product.kind !== 'corner');
  /** Pieces wall by wall, each from its corner end, then those on no wall by plan x, z. */
  const along = (list: PlacedPiece[]): PlacedPiece[] => {
    const onWall = new Map<number, PlacedPiece[]>();
    const loose: PlacedPiece[] = [];
    for (const pc of list) {
      const w = wall.get(pc.item.id);
      if (w === undefined || !room) loose.push(pc);
      else onWall.set(w, [...(onWall.get(w) ?? []), pc]);
    }
    const out: PlacedPiece[] = [];
    const used = new Set(onWall.keys());
    for (const w of [...used].sort((a, b) => a - b)) {
      const end = cornerEnd(room!, w, corners, used);
      const key = (pc: PlacedPiece) => alongFrom(room!, w, end, pc.bounds);
      out.push(...onWall.get(w)!.sort((a, b) => key(a) - key(b) || byPlan(a, b)));
    }
    return [...out, ...loose.sort(byPlan)];
  };
  const cornerOrder = [...corners].sort(
    (a, b) =>
      Number(!onFloor(a)) - Number(!onFloor(b)) ||
      (wall.get(a.item.id) ?? Infinity) - (wall.get(b.item.id) ?? Infinity) ||
      byPlan(a, b),
  );
  const pieceStages: [ProjectStageId, PlacedPiece[]][] = [
    ['corners', cornerOrder],
    ['base', along(rest.filter(onFloor))],
    ['wall', along(rest.filter((pc) => !onFloor(pc)))],
  ];
  // Linked copies once, where the first of them comes, with how many there are.
  const linked = new Map<string, OrderEntry>();
  const entries = new Map<ProjectStageId, OrderEntry[]>();
  for (const [id, list] of pieceStages) {
    const out: OrderEntry[] = [];
    for (const pc of list) {
      const link = pc.item.linkId;
      const have = link ? linked.get(link) : undefined;
      if (have) {
        have.ids.push(pc.item.id);
        have.times += pc.item.quantity;
        continue;
      }
      const w = wall.get(pc.item.id);
      const entry: OrderEntry = {
        kind: 'piece',
        ids: [pc.item.id],
        name: pc.item.design.name,
        design: pc.item.design,
        times: pc.item.quantity,
        ...(w !== undefined ? { wall: w } : {}),
      };
      if (link) linked.set(link, entry);
      out.push(entry);
    }
    entries.set(id, out);
  }
  // Run parts (identical labels once, counted), common tops and bottoms, then sinks in the order of their bases.
  const run: OrderEntry[] = [];
  const same = new Map<string, OrderEntry>();
  const parts = [...(project.runParts ?? [])].sort(
    (a, b) =>
      RUN_RANK[a.kind] - RUN_RANK[b.kind] ||
      a.box.x - b.box.x ||
      a.box.z - b.box.z ||
      a.box.y - b.box.y ||
      byId(a.id, b.id),
  );
  for (const rp of parts) {
    const key = `${RUN_RANK[rp.kind]}|${rp.label}`;
    const have = same.get(key);
    if (have) {
      have.ids.push(rp.id);
      have.times++;
      continue;
    }
    const entry: OrderEntry = { kind: rp.kind, ids: [rp.id], name: rp.label, times: 1 };
    same.set(key, entry);
    run.push(entry);
  }
  const common = new Map<string, { label: string; box: Box }>();
  for (const p of model.model.panels)
    if (p.id.startsWith('common:') && !common.has(p.nodeId))
      common.set(p.nodeId, { label: p.label, box: p.box });
  for (const [id, c] of [...common].sort(
    ([ia, a], [ib, b]) => a.box.x - b.box.x || a.box.z - b.box.z || byId(ia, ib),
  ))
    run.push({ kind: 'common', ids: [id], name: c.label, times: 1 });
  const at = new Map<string, number>();
  PROJECT_STAGE_ORDER.flatMap((s) => entries.get(s) ?? []).forEach((e, k) =>
    e.ids.forEach((id) => at.set(id, k)),
  );
  for (const sk of (project.sinks ?? [])
    .filter((s) => at.has(s.baseId))
    .sort((a, b) => at.get(a.baseId)! - at.get(b.baseId)! || byId(a.id, b.id)))
    run.push({ kind: 'sink', ids: [sk.id], name: 'Sink cut-out', times: 1, size: [sk.w, sk.d] });
  entries.set('run', run);
  const stages: ProjectStage[] = [];
  for (const id of PROJECT_STAGE_ORDER) {
    const list = entries.get(id) ?? [];
    if (!list.length) continue;
    stages.push({ id, n: stages.length + 1, title: PROJECT_STAGE_TITLE[id], entries: list });
  }
  return stages;
}

/** Stage titles as print text keys (Romanian, ADR-020/157). */
const STAGE_PT: Record<ProjectStageId, PrintKey> = {
  corners: 'Corpuri de colț',
  base: 'Corpuri de jos',
  wall: 'Corpuri suspendate',
  run: 'Piese de rând',
};

/**
 * The Project order as the printed assembly sheet starts with it (ADR-178), in the print language (ADR-157): a
 * heading and each numbered stage with its lines (piece names via `printPieceName`; part names via `partRo`).
 */
export function projectOrderPrint(stages: ProjectStage[]): {
  heading: string;
  stages: { n: number; title: string; lines: string[] }[];
} {
  return {
    heading: pt('Ordinea în proiect'),
    stages: stages.map((s) => ({
      n: s.n,
      title: pt(STAGE_PT[s.id]),
      lines: s.entries.map((e) => {
        const name =
          e.kind === 'sink'
            ? pt('Decupaj chiuvetă {w} × {d} mm', { w: e.size![0], d: e.size![1] })
            : e.kind === 'piece'
              ? e.design
                ? printPieceName(e.design)
                : e.name
              : partRo(e.name);
        const wall = e.wall !== undefined ? ` (${pt('peretele {n}', { n: e.wall + 1 })})` : '';
        return `${name}${e.times > 1 ? ` × ${e.times}` : ''}${wall}`;
      }),
    })),
  };
}

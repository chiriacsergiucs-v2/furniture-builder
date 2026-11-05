/**
 * Step-by-step assembly list (ADR-174): a piece's panels ordered into steps by their role and what they touch —
 * bottom, sides, fixed dividers and shelves, top, back, plinth, adjustable shelves, drawer boxes, fronts and doors,
 * handles, hanging — each step with its parts, the carcass joints it closes (the pairs ADR-074 counts, assigned to
 * the later of the two panels' steps) and the hardware scheduled on its parts. The order comes from geometry and
 * roles only: it is guidance (ADR-010); the user's joints, fasteners and drilling decide. Pure.
 */
import { carcassJointPairs } from './fasteners';
import { t } from './i18n';
import type { FurnitureModel, HardwareItem, HardwareKind, Panel, PanelRole } from './types';

export type StepId =
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
  | 'loose'
  | 'also';

export interface StepPart {
  /** Panel ids of the model (one entry per identical part). */
  panelIds: string[];
  label: string;
  quantity: number;
  /** Finished size, mm: length × width × thickness. */
  size: [number, number, number];
}

export interface AssemblyStep {
  id: StepId;
  /** Step number from 1, in order. */
  n: number;
  title: string;
  parts: StepPart[];
  /** Carcass joints this step closes (ADR-074's pairs). */
  joints: number;
  hardware: { kind: HardwareKind; label: string; quantity: number }[];
}

export const STEP_ORDER: StepId[] = [
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
  'loose',
  'also',
];

/** Step titles: the `t()` keys shown on the tab; the printed sheet uses `pt()` with the same meaning. */
export const STEP_TITLE: Record<StepId, string> = {
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
  loose: t('Loose parts'),
  also: t('Also'),
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
  // Joints: each carcass pair counts in the later of its two panels' steps.
  const joints = new Map<StepId, number>();
  for (const [a, b] of carcassJointPairs(model)) {
    const sa = STEP_ORDER.indexOf(stepOfId.get(a.id) ?? 'also'),
      sb = STEP_ORDER.indexOf(stepOfId.get(b.id) ?? 'also');
    const s = STEP_ORDER[Math.max(sa, sb)];
    joints.set(s, (joints.get(s) ?? 0) + 1);
  }
  const hw = new Map<StepId, HardwareItem[]>();
  for (const h of model.hardware) {
    const s = HW_STEP[h.kind] ?? 'hang';
    hw.set(s, [...(hw.get(s) ?? []), h]);
  }
  const steps: AssemblyStep[] = [];
  for (const id of STEP_ORDER) {
    const panels = byStep.get(id) ?? [];
    const items = hw.get(id) ?? [];
    if (!panels.length && !items.length && !(joints.get(id) ?? 0)) continue;
    const parts = new Map<string, StepPart>();
    for (const p of panels) {
      const sz = size(p);
      const key = `${p.label}|${sz.join('x')}|${p.materialId}`;
      const part = parts.get(key);
      if (part) {
        part.panelIds.push(p.id);
        part.quantity++;
      } else parts.set(key, { panelIds: [p.id], label: p.label, quantity: 1, size: sz });
    }
    const hardware = new Map<string, { kind: HardwareKind; label: string; quantity: number }>();
    for (const h of items) {
      const key = `${h.kind}|${h.label}`;
      const have = hardware.get(key);
      if (have) have.quantity += h.quantity;
      else hardware.set(key, { kind: h.kind, label: h.label, quantity: h.quantity });
    }
    steps.push({
      id,
      n: steps.length + 1,
      title: STEP_TITLE[id],
      parts: [...parts.values()],
      joints: joints.get(id) ?? 0,
      hardware: [...hardware.values()],
    });
  }
  return steps;
}

/**
 * Compatibility rules as data (ADR-100). One table, `COMPAT_RULES`: each rule says what it applies to (product kind,
 * catalog family function, placement kind), which named predicate checks it and with what parameters, its severity
 * (`refuse` stops a snap, `warning` is named), where it runs, the text shown and its message templates. Rules test
 * what a piece is (its kind, catalog family and placement), never a brand.
 *
 * One evaluator (`evaluate`) runs the table in two places: while snapping (`snap.ts`: a failed `refuse` rule removes
 * the candidate and is named "Won’t snap to …", a failed `warning` rule is named in the preview), and in the project
 * checks (`compatChecks`, run by `buildProjectModel`) for pieces that touch side by side, where every failed rule is a
 * warning that never blocks export (ADR-008). Pure and deterministic.
 */
import { findFamily, ROOM_LABEL, type CatalogFamily, type FunctionGroup } from './catalog';
import { isWallHung, type PlacedPiece, type ProjectItem, type RunPart } from './project';
import type { Box, Diagnostic, Mm, Product } from './types';

/** How a piece hangs for the side-to-side rules. */
export type Mount = 'floor' | 'wall' | 'above';

export type RuleSeverity = 'refuse' | 'warning';

/** The named checks a rule may use; each is implemented once below. */
export type RulePredicate =
  | 'sides-only'
  | 'same-mount'
  | 'back-to-wall'
  | 'same-depth'
  | 'same-height-under-worktop'
  | 'shared-room';

export type CompatRuleId =
  'side-only' | 'same-mount' | 'back-to-wall' | 'depth-match' | 'height-match' | 'family';

export interface CompatRule {
  id: CompatRuleId;
  name: string;
  /** What it looks at. Absent = any. */
  appliesTo: {
    productKinds?: Product['kind'][];
    functions?: FunctionGroup[];
    placements?: Mount[];
    /** Further condition, in words, for the Rules list. */
    when?: string;
  };
  check: { predicate: RulePredicate; params: Record<string, number> };
  /** While snapping: `refuse` removes the candidate, `warning` is named in the preview. In Checks: a warning. */
  severity: RuleSeverity;
  /** Where it runs. */
  where: ('snap' | 'checks')[];
  /** The rule in words, for the Rules list and the messages. */
  text: string;
  /**
   * Message templates: `snap` follows "Won’t snap to <piece>: " (refuse) or is a preview note (warning); `checks` is
   * the Checks warning. Placeholders: {a} and {b} the pieces' names, {reason} what the check found, {text} the rule.
   */
  messages: { snap?: string; checks?: string };
  /** A refusal named even when the piece snaps to something else (rules about what pieces are, not their faces). */
  namedWhenSnapped?: boolean;
  /** ADR-071 repairs that may fix it (none exist for these rules yet, G-095). */
  repairs: string[];
}

/** Carcass units: the pieces "base unit" and "floor unit" mean here (as the run parts, ADR-036). */
const UNITS: Product['kind'][] = ['cabinet', 'corner'];

export const COMPAT_RULES: readonly CompatRule[] = [
  {
    id: 'side-only',
    name: 'Sides join sides',
    appliesTo: {},
    check: { predicate: 'sides-only', params: {} },
    severity: 'refuse',
    where: ['snap'],
    text: 'only sides join: a back or a front never snaps to another piece',
    messages: { snap: '{reason}' },
    repairs: [],
  },
  {
    id: 'same-mount',
    name: 'Same placement',
    appliesTo: {},
    check: { predicate: 'same-mount', params: {} },
    severity: 'refuse',
    where: ['snap'],
    text: 'side to side only floor unit with floor unit and wall unit with wall unit',
    messages: { snap: '{reason}' },
    repairs: [],
  },
  {
    id: 'back-to-wall',
    name: 'Back to wall',
    appliesTo: {},
    check: { predicate: 'back-to-wall', params: {} },
    severity: 'refuse',
    where: ['snap'],
    text: 'only the back of a piece goes against a wall; a side goes against a wall only in a corner',
    messages: { snap: '{reason}' },
    repairs: [],
  },
  {
    id: 'depth-match',
    name: 'Depth match',
    appliesTo: { productKinds: UNITS, placements: ['floor'], when: 'touching side by side' },
    // Any difference warns: no tolerance until the user names one (ADR-100 answer, 2026-10-26).
    check: { predicate: 'same-depth', params: { tolerance: 0 } },
    severity: 'warning',
    where: ['snap', 'checks'],
    text: 'depth match: floor units side by side should be equally deep',
    messages: {
      snap: '{reason}',
      checks: '{a} and {b} stand side by side with different depths ({reason} mm); {text}.',
    },
    repairs: [],
  },
  {
    id: 'height-match',
    name: 'Height match',
    appliesTo: {
      productKinds: UNITS,
      placements: ['floor'],
      when: 'touching side by side under one run worktop',
    },
    check: { predicate: 'same-height-under-worktop', params: { tolerance: 0 } },
    severity: 'warning',
    where: ['checks'],
    text: 'height match: base units under one worktop should be equally high',
    messages: {
      checks: '{a} and {b} are under one worktop with different heights ({reason} mm); {text}.',
    },
    repairs: [],
  },
  {
    id: 'family',
    name: 'Family',
    appliesTo: {
      placements: ['floor', 'wall'],
      when: 'both pieces come from catalog families',
    },
    check: { predicate: 'shared-room', params: {} },
    severity: 'refuse',
    where: ['snap', 'checks'],
    text: 'family rule: pieces join side by side only when their catalog families share a room',
    messages: { snap: '{reason}; {text}', checks: '{reason}; {text}.' },
    namedWhenSnapped: true,
    repairs: [],
  },
];

export const compatRule = (id: CompatRuleId): CompatRule => COMPAT_RULES.find((r) => r.id === id)!;

const MOUNT_NAME: Record<Mount, string> = {
  floor: 'floor unit',
  wall: 'wall unit',
  above: 'piece placed on another piece',
};

/** Whether the piece stands on the floor, hangs on the wall, or sits on another piece. */
export function mountOf(item: ProjectItem): Mount {
  const k = item.placement?.kind;
  if (k === 'floor' || k === 'wall' || k === 'above') return k;
  return isWallHung(item.design) ? 'wall' : 'floor';
}

/** The catalog family a piece was inserted from (ADR-028 origin), if it is a shipped family (G-094). */
export function familyOf(item: ProjectItem): CatalogFamily | undefined {
  const id = item.design.catalog?.origin?.catalogId;
  return id ? findFamily(id) : undefined;
}

/** Whether a rule's "applies to" covers a piece placed as `mount`. */
export function appliesTo(
  rule: CompatRule,
  item: ProjectItem,
  mount: Mount = mountOf(item),
): boolean {
  const a = rule.appliesTo;
  if (a.productKinds && !a.productKinds.includes(item.design.product.kind)) return false;
  if (a.placements && !a.placements.includes(mount)) return false;
  if (a.functions) {
    const f = familyOf(item);
    if (!f || !a.functions.includes(f.function)) return false;
  }
  return true;
}

const rooms = (f: CatalogFamily) => f.rooms.map((r) => ROOM_LABEL[r]).join(', ');

// ---------------------------------------------------------------------------
// The predicates: each returns null when the rule holds (or does not concern this join), else what it found.
// ---------------------------------------------------------------------------

/**
 * What a rule is checked on: a side join or two touching pieces (`b` set), or a face of `a` against a wall.
 * Sizes are in mm; the snap passes footprint sizes (ADR-070), the checks the carcass depth and the overall height.
 */
export interface JoinContext {
  a: ProjectItem;
  mountA: Mount;
  faceA: string;
  b?: ProjectItem;
  mountB?: Mount;
  faceB?: string;
  depthA?: Mm;
  depthB?: Mm;
  heightA?: Mm;
  heightB?: Mm;
  /** Both pieces are under one run worktop (ADR-036). */
  underOneWorktop?: boolean;
}

const differs = (what: string, a: Mm | undefined, b: Mm | undefined, tol: number) =>
  a !== undefined && b !== undefined && Math.abs(a - b) > tol ? `${what} ${a} vs ${b}` : null;

const PREDICATES: Record<RulePredicate, (rule: CompatRule, c: JoinContext) => string | null> = {
  'sides-only': (_, c) =>
    c.b && !(c.faceA === 'side' && c.faceB === 'side')
      ? `a ${c.faceA} cannot join a ${c.faceB}; only sides join`
      : null,
  'same-mount': (_, c) =>
    c.b && c.mountB && c.mountA !== c.mountB
      ? `a ${MOUNT_NAME[c.mountA]} cannot join a ${MOUNT_NAME[c.mountB]}`
      : null,
  'back-to-wall': (_, c) =>
    !c.b && c.faceA !== 'back'
      ? `only the back of a piece goes against a wall (this is its ${c.faceA}); a side goes against a wall only in a corner`
      : null,
  'same-depth': (r, c) =>
    c.b ? differs('depth', c.depthA, c.depthB, r.check.params.tolerance ?? 0) : null,
  'same-height-under-worktop': (r, c) =>
    c.b && c.underOneWorktop
      ? differs('height', c.heightA, c.heightB, r.check.params.tolerance ?? 0)
      : null,
  'shared-room': (_, c) => {
    if (!c.b) return null;
    const fa = familyOf(c.a),
      fb = familyOf(c.b);
    // A piece with no shipped family: nothing is known about it, so nothing is refused.
    if (!fa || !fb || fa.rooms.some((r) => fb.rooms.includes(r))) return null;
    return `${c.a.design.name} (${fa.name}: ${rooms(fa)}) and ${c.b.design.name} (${fb.name}: ${rooms(fb)}) share no room`;
  },
};

export interface Finding {
  rule: CompatRule;
  /** What the check found: "depth 560 vs 500". */
  reason: string;
  /** The rule's message for where it ran, filled in. */
  message: string;
}

const fill = (tpl: string, rule: CompatRule, c: JoinContext, reason: string) =>
  tpl
    .replace('{a}', c.a.design.name)
    .replace('{b}', c.b?.design.name ?? '')
    .replace('{reason}', reason)
    .replace('{text}', rule.text);

/**
 * Every rule that runs at `stage`, applies to the piece(s) and fails, in table order, with its message. The one
 * evaluator for snapping and checks: behaviour follows the table (where, applies to, predicate, parameters).
 */
export function evaluate(stage: 'snap' | 'checks', c: JoinContext): Finding[] {
  const out: Finding[] = [];
  for (const rule of COMPAT_RULES) {
    if (!rule.where.includes(stage)) continue;
    if (!appliesTo(rule, c.a, c.mountA)) continue;
    if (c.b && !appliesTo(rule, c.b, c.mountB)) continue;
    const reason = PREDICATES[rule.check.predicate](rule, c);
    if (!reason) continue;
    const tpl = rule.messages[stage] ?? '{reason}; {text}';
    out.push({ rule, reason, message: fill(tpl, rule, c, reason) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Project checks (ADR-100): the rules over pieces that touch side by side, as warnings.
// ---------------------------------------------------------------------------

/** The carcass depth of a cabinet or corner unit (an L corner's footprint is its wing), else the footprint depth. */
function depthOf(pc: PlacedPiece): Mm {
  const p = pc.item.design.product;
  if (p.kind === 'cabinet' || p.kind === 'corner') return p.params.depth;
  return pc.facing.axis === 'z' ? pc.bounds.d : pc.bounds.w;
}

/**
 * Whether two placed pieces touch side by side: both face the same way, one's side face lies on the other's, and
 * their footprints and heights overlap along that face.
 */
export function touchSideBySide(a: PlacedPiece, b: PlacedPiece): boolean {
  if (a.facing.axis !== b.facing.axis || a.facing.sign !== b.facing.sign) return false;
  const along: 'x' | 'z' = a.facing.axis === 'z' ? 'x' : 'z';
  const lo = (p: Box) => (along === 'x' ? p.x : p.z);
  const hi = (p: Box) => (along === 'x' ? p.x + p.w : p.z + p.d);
  const dlo = (p: Box) => (along === 'x' ? p.z : p.x);
  const dhi = (p: Box) => (along === 'x' ? p.z + p.d : p.x + p.w);
  const A = a.bounds,
    B = b.bounds;
  if (hi(A) !== lo(B) && hi(B) !== lo(A)) return false;
  const depthOverlap = Math.min(dhi(A), dhi(B)) - Math.max(dlo(A), dlo(B));
  const heightOverlap = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
  return depthOverlap > 0 && heightOverlap > 0;
}

/**
 * Every rule that runs in checks, for every pair of pieces that touch side by side, in item order. Each failed rule
 * is a warning (never an error: it does not block export) naming both pieces, what differs and the rule.
 */
export function compatChecks(pieces: PlacedPiece[], runParts: RunPart[] = []): Diagnostic[] {
  const out: Diagnostic[] = [];
  const worktops = runParts.filter((rp) => rp.kind === 'worktop');
  for (let i = 0; i < pieces.length; i++)
    for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i],
        b = pieces[j];
      if (!touchSideBySide(a, b)) continue;
      const found = evaluate('checks', {
        a: a.item,
        mountA: mountOf(a.item),
        faceA: 'side',
        b: b.item,
        mountB: mountOf(b.item),
        faceB: 'side',
        depthA: depthOf(a),
        depthB: depthOf(b),
        heightA: a.bounds.h,
        heightB: b.bounds.h,
        underOneWorktop: worktops.some(
          (w) => !!w.from?.includes(a.item.id) && w.from.includes(b.item.id),
        ),
      });
      for (const f of found)
        out.push({
          severity: 'warning',
          code: `compat-${f.rule.id}`,
          message: f.message,
          nodeId: b.item.id,
          itemIds: [a.item.id, b.item.id],
        });
    }
  return out;
}

/**
 * Duplicate, mirror and turn a piece about its centre in a project (ADR-069). Pure functions over the stored project:
 * nothing stored changes shape, every result is whole millimetres and quarter turns, and overlaps that result are left
 * to the usual diagnostics (ADR-008).
 */
import { t } from './i18n';
import { newId, SCHEMA_VERSION } from './design';
import { overlaps } from './geometry';
import {
  carriedBy,
  LOCKED_HINT,
  mirroredRotation,
  moveBlocked,
  turnBlocked,
  TURN_LOCKED_HINT,
  pieceName,
  placedBounds,
  placedOutline,
  quarterTurn,
  resolvePlacements,
  rotationOf,
  splitRotation,
  type MoveResult,
  type Project,
  type ProjectItem,
} from './project';
import { placedBox } from './panelset';
import { withGroups } from './groupMove';
import type { Box, Design, Product, Space } from './types';

// ---------------------------------------------------------------------------
// Handing: what "left" and "right" mean inside each kind of piece
// ---------------------------------------------------------------------------

/**
 * The handed fields of each product root, in one place (ADR-069 consequence): mirroring swaps exactly these. A field
 * missing here would leave a piece half-mirrored, so `tests/arrange.test.ts` checks every product kind against it.
 */
export const HANDED_FIELDS: Record<Product['kind'], string[]> = {
  cabinet: [
    'interior: order of side-by-side spaces',
    'interior: single door hinge (handle follows)',
  ],
  corner: ['side (the generator mirrors the whole unit, inside and fronts included)'],
  desk: [
    'support: pedestal-left ↔ pedestal-right',
    'pedestal.left ↔ pedestal.right, each mirrored inside',
  ],
  panel: [],
  frame: [],
  panels: ['place.x of placed panels, reflected across the placed parts'],
};

/** Mirror a space tree: side-by-side spaces in reverse order, single doors hinged on the other side. */
export function mirrorSpace(s: Space): Space {
  let out: Space = s;
  if (s.front?.kind === 'doors' && s.front.count === 1) {
    const { hinge, ...rest } = s.front;
    // Absent means left (ADR-024), so a right hinge goes back to absent: mirroring twice gives the same design.
    out = { ...out, front: hinge === 'right' ? rest : { ...rest, hinge: 'right' } };
  }
  if (s.kind === 'split') {
    const children = s.children.map(mirrorSpace);
    out = {
      ...(out as typeof s),
      children: s.axis === 'x' ? children.reverse() : children,
      sizes: s.axis === 'x' ? [...s.sizes].reverse() : s.sizes,
    };
    // ADR-205: the rounding remainder stays on the same physical part, so the copy matches to the mm; mirroring twice
    // takes the flag off again.
    if (s.axis === 'x') {
      const { remainderFirst, ...rest } = out as typeof s;
      out = remainderFirst ? rest : { ...rest, remainderFirst: true };
    }
  }
  return out;
}

type MirrorResult = { ok: true; design: Design } | { ok: false; design: Design; reason: string };

export const NOTHING_TO_MIRROR = t('Nothing to mirror in this piece');

/**
 * Swap left and right inside one piece (ADR-069): hinges, pedestal sides, corner side, the order of side-by-side
 * spaces and placed panels. Part sizes stay as they are, so the cut list keeps its rows. A piece with nothing handed
 * comes back unchanged with a reason.
 */
export function mirrorDesign(d: Design): MirrorResult {
  const prod = d.product;
  const same = (reason: string): MirrorResult => ({ ok: false, design: d, reason });
  const withProduct = (product: Product): MirrorResult => {
    // A split's remainder order needs design schemaVersion 9 (ADR-205).
    const flagged = JSON.stringify(product).includes('"remainderFirst"');
    const design: Design = flagged
      ? { ...d, schemaVersion: SCHEMA_VERSION, product }
      : { ...d, product };
    return JSON.stringify(product) === JSON.stringify(prod)
      ? same(NOTHING_TO_MIRROR)
      : { ok: true, design };
  };
  switch (prod.kind) {
    case 'cabinet':
      return withProduct({
        ...prod,
        params: { ...prod.params, interior: mirrorSpace(prod.params.interior) },
      });
    case 'corner':
      return withProduct({
        ...prod,
        params: { ...prod.params, side: prod.params.side === 'left' ? 'right' : 'left' },
      });
    case 'desk': {
      const p = prod.params;
      if (p.support === 'gables') return same(NOTHING_TO_MIRROR);
      const support =
        p.support === 'pedestal-left'
          ? 'pedestal-right'
          : p.support === 'pedestal-right'
            ? 'pedestal-left'
            : p.support;
      const { left, right, ...ped } = p.pedestal;
      const pedestal = {
        ...ped,
        ...(right ? { left: mirrorSpace(right) } : {}),
        ...(left ? { right: mirrorSpace(left) } : {}),
      };
      return withProduct({ ...prod, params: { ...p, support, pedestal } });
    }
    case 'panels': {
      const thick = new Map(d.materials.map((m) => [m.id, m.thickness]));
      const boxes = prod.params.panels.map((lp) => placedBox(lp, thick.get(lp.materialId) ?? 0));
      const placed = boxes.filter((b): b is Box => !!b);
      if (!placed.length) return same(NOTHING_TO_MIRROR);
      const x0 = Math.min(...placed.map((b) => b.x)),
        x1 = Math.max(...placed.map((b) => b.x + b.w));
      const panels = prod.params.panels.map((lp, i) => {
        const b = boxes[i];
        return b && lp.place ? { ...lp, place: { ...lp.place, x: x0 + x1 - (b.x + b.w) } } : lp;
      });
      return withProduct({ ...prod, params: { ...prod.params, panels } });
    }
    case 'frame': {
      const p = prod.params;
      // The lounger backrest and the daybed side panel are built at their stored end (ADR-207): mirroring swaps it.
      // The end is a schemaVersion 9 field, so the mirrored design is written at the current version.
      const swapped = (product: Product): MirrorResult => ({
        ok: true,
        design: { ...d, schemaVersion: SCHEMA_VERSION, product },
      });
      if (p.kind === 'bench' && p.backrest) {
        const { end, ...rest } = p.backrest;
        const backrest = end === 'right' ? rest : { ...rest, end: 'right' as const };
        return swapped({ ...prod, params: { ...p, backrest } });
      }
      if (p.kind === 'bed' && p.bed && p.bed.sidePanelHeight > 0) {
        const { sidePanelEnd, ...rest } = p.bed;
        const bed = sidePanelEnd === 'right' ? rest : { ...rest, sidePanelEnd: 'right' as const };
        return swapped({ ...prod, params: { ...p, bed } });
      }
      return same(NOTHING_TO_MIRROR);
    }
    case 'panel':
      return same(NOTHING_TO_MIRROR);
  }
}

// ---------------------------------------------------------------------------
// Project operations
// ---------------------------------------------------------------------------

const boundsOf = (project: Project) =>
  new Map(resolvePlacements(project).items.map((i) => [i.id, placedBounds(i)]));

/** Each piece as one box before any extra angle (ADR-121): same centre as its bounds, its own width and depth. */
const outlinesOf = (project: Project) =>
  new Map(resolvePlacements(project).items.map((i) => [i.id, placedOutline(i)]));

/** Move an item by `dx` / `dz`: its stored position, and its offset when it sits on another piece. */
function shifted(it: ProjectItem, dx: number, dz: number): ProjectItem {
  const position = { ...it.position, x: it.position.x + dx, z: it.position.z + dz };
  const placement =
    it.placement?.kind === 'above'
      ? { ...it.placement, offsetX: it.placement.offsetX + dx }
      : it.placement;
  return { ...it, position, ...(placement ? { placement } : {}) };
}

/**
 * A copy of a piece with new ids (ADR-011), touching it on its own right along the wall it stands on (ADR-251; was the
 * room's x, ADR-069), or on its left when the right is taken and the left is free (otherwise on the right anyway; the overlap is the usual diagnostic). Same placement,
 * turn and quantity. Returns null when the piece is not in the project.
 */
export function duplicateItem(
  project: Project,
  id: string,
): { project: Project; id: string } | null {
  const at = project.items.findIndex((i) => i.id === id);
  if (at < 0) return null;
  const bounds = boundsOf(project);
  const b = bounds.get(id)!;
  const src = project.items[at];
  // Along the wall the piece stands on (ADR-251, user 2026-11-10): on its own right, else its own left. Turn 0 and
  // 180 run along x, 90 and 270 along z; the piece's right is +x, −z, −x, +z for turns 0, 90, 180, 270.
  const axis = src.rotationY % 180 === 0 ? 'x' : 'z';
  const size = axis === 'x' ? b.w : b.d;
  const rightSign = src.rotationY === 0 || src.rotationY === 270 ? 1 : -1;
  const at1 = (v: number) => (axis === 'x' ? { ...b, x: v } : { ...b, z: v });
  const free = (v: number) => ![...bounds.values()].some((o) => overlaps(o, at1(v)));
  const right = b[axis] + rightSign * size,
    left = b[axis] - rightSign * size;
  const to = free(right) || !free(left) ? right : left;
  const x = axis === 'x' ? to : b.x;
  const z = axis === 'z' ? to : b.z;
  // The copy is a new piece placed for the user: it starts unlocked (ADR-095) and not linked (ADR-111).
  const { locked: _locked, linkId: _link, ...unlocked } = structuredClone(src);
  void _locked;
  void _link;
  const copy: ProjectItem = {
    ...shifted(unlocked, x - b.x, z - b.z),
    id: newId(),
  };
  copy.design = { ...copy.design, id: newId() };
  const items = [...project.items];
  items.splice(at + 1, 0, copy);
  return { project: { ...project, items }, id: copy.id };
}

/**
 * Turn a piece a quarter turn about the centre of its footprint (ADR-069); `dir` 1 turns the front from facing you
 * to facing right. The new position is whole mm: a half-mm centre rounds down when the piece ends up turned 90° or
 * 270° and up when it ends up at 0° or 180°, so two turns cover the same floor and four turns return the piece to
 * exactly where it was (the centre moves at most ½ mm). A piece on another piece keeps its back aligned with its base
 * (ADR-031), so only its centre along x is kept. Unknown ids return the same project.
 */
export function turnAboutCentre(project: Project, id: string, dir: 1 | -1 = 1): Project {
  return tryTurn(project, id, dir).project;
}

/**
 * `turnAboutCentre` with the reason when it is refused (ADR-095): a locked piece does not turn, and neither does a
 * piece a locked piece rests on (it would follow).
 */
export function tryTurn(project: Project, id: string, dir: 1 | -1 = 1): MoveResult {
  const it = project.items.find((i) => i.id === id);
  if (!it) return { project };
  const reason = moveBlocked(project, [id]) ?? turnBlocked(project, [id]);
  if (reason) return { project, reason };
  // The quarter-turned outline, not the box around an angled piece (ADR-121): the extra angle turns with it.
  const b = outlinesOf(project).get(id)!;
  const rotationY = quarterTurn(it.rotationY, dir);
  const half = (n: number) => (rotationY % 180 === 0 ? Math.ceil(n / 2) : Math.floor(n / 2));
  const turned = { ...shifted(it, half(b.w - b.d), half(b.d - b.w)), rotationY };
  return { project: { ...project, items: project.items.map((i) => (i.id === id ? turned : i)) } };
}

/**
 * Turn a piece to whole degrees `deg` (0–359) about the centre of its footprint (ADR-121): the quarter part turns as
 * `tryTurn` does (the same whole-mm rounding), the rest is the piece's extra angle about that centre. Outside 0–359 or
 * not whole is refused with the reason, never clamped (ADR-008); so is a locked piece (ADR-095).
 */
export function setItemRotation(project: Project, id: string, deg: number): MoveResult {
  const it = project.items.find((i) => i.id === id);
  if (!it) return { project };
  const split = splitRotation(deg);
  if (!split) return { project, reason: t('Rotation must be whole degrees from 0 to 359.') };
  if (split.rotationY === it.rotationY && (split.angle ?? 0) === (it.angle ?? 0))
    return { project };
  const reason = moveBlocked(project, [id]) ?? turnBlocked(project, [id]);
  if (reason) return { project, reason };
  // A grouped piece turns only with its group (ADR-148 "Always together", ADR-250).
  if (withGroups(project, [id]).length > 1)
    return {
      project,
      reason: t(
        '{name} is in a group; turn the group with Turn ↺ or Turn ↻, or ungroup it to turn it alone.',
        { name: pieceName(project, id) },
      ),
    };
  let next = project;
  // Quarter turns first, the short way round, each keeping the centre.
  const steps = ((split.rotationY - it.rotationY) / 90 + 4) % 4;
  for (let i = 0; i < (steps === 3 ? 1 : steps); i++)
    next = tryTurn(next, id, steps === 3 ? -1 : 1).project;
  return {
    project: {
      ...next,
      items: next.items.map((i) => {
        if (i.id !== id) return i;
        const { angle: _angle, ...flat } = i;
        void _angle;
        return split.angle ? { ...flat, angle: split.angle } : flat;
      }),
    },
  };
}

/**
 * Mirror one piece in place (ADR-069). `reason` is set when there was nothing to mirror or the piece is locked
 * (ADR-095); the project is unchanged then.
 */
export function mirrorItem(project: Project, id: string): MoveResult {
  const it = project.items.find((i) => i.id === id);
  if (!it) return { project };
  if (it.locked) return { project, reason: `${LOCKED_HINT}: ${pieceName(project, id)}.` };
  // Mirroring turns the piece's hinges and handles round (ADR-171): a locked turn refuses it.
  if (it.turnLocked) return { project, reason: `${TURN_LOCKED_HINT}: ${pieceName(project, id)}.` };
  const m = mirrorDesign(it.design);
  if (!m.ok) return { project, reason: m.reason };
  return {
    project: {
      ...project,
      items: project.items.map((i) => (i.id === id ? { ...i, design: m.design } : i)),
    },
  };
}

/** `ids` and the pieces stacked-connected to them, repeatedly (ADR-207: a wall unit over its base). */
function stackedWith(project: Project, ids: readonly string[]): string[] {
  const out = [...ids];
  for (let i = 0; i < out.length; i++)
    for (const c of project.connections ?? []) {
      if (c.kind !== 'stacked' || c.itemIds.length !== 2 || !c.itemIds.includes(out[i])) continue;
      const other = c.itemIds[0] === out[i] ? c.itemIds[1] : c.itemIds[0];
      if (!out.includes(other)) out.push(other);
    }
  return out;
}

/** Open-interval overlap of two spans. */
const spans = (a0: number, a1: number, b0: number, b1: number) =>
  Math.min(a1, b1) > Math.max(a0, b0);

/** The widest gap a run bridges, as for run parts and their fillers (ADR-036). */
const RUN_GAP = 150;

/**
 * The run `id` is in: pieces at the same height and depth side by side along x, touching or with a filler gap of up
 * to 150 mm as for run parts (ADR-036), directly or through each other; sorted left to right. Always includes `id`
 * when it is in the project. `placed` may pass the placed bounds the project model already holds.
 */
export function touchingRun(project: Project, id: string, placed?: Map<string, Box>): string[] {
  const bounds = placed ?? boundsOf(project);
  if (!bounds.has(id)) return [];
  // Along the wall the piece stands on (ADR-251): x for turns 0 and 180, z for 90 and 270.
  const axis = runAxis(project, id);
  const near = (a: Box, b: Box) => {
    const gap =
      axis === 'x'
        ? Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w))
        : Math.max(b.z - (a.z + a.d), a.z - (b.z + b.d));
    return (
      gap >= 0 &&
      gap <= RUN_GAP &&
      spans(a.y, a.y + a.h, b.y, b.y + b.h) &&
      (axis === 'x' ? spans(a.z, a.z + a.d, b.z, b.z + b.d) : spans(a.x, a.x + a.w, b.x, b.x + b.w))
    );
  };
  const run = new Set([id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const [k, b] of bounds)
      if (!run.has(k) && [...run].some((r) => near(bounds.get(r)!, b))) {
        run.add(k);
        grew = true;
      }
  }
  return [...run].sort((a, b) => bounds.get(a)!.x - bounds.get(b)!.x || bounds.get(a)!.z - bounds.get(b)!.z);
}

/** The axis a run along the piece's wall takes (ADR-251): x for quarter turns 0 and 180, z for 90 and 270. */
function runAxis(project: Project, id: string): 'x' | 'z' {
  return (project.items.find((i) => i.id === id)?.rotationY ?? 0) % 180 === 0 ? 'x' : 'z';
}

/**
 * Mirror the run `id` is in (ADR-069): every piece's position reflects about the run's centre and each piece is
 * mirrored. Pieces resting on a run piece (and on those, at any depth) are mirrored too and keep their place over
 * their base, reflected. Pieces with nothing to mirror only move; `reasons` lists them. Every member of a group with a
 * piece in the run mirrors with it (ADR-176): the run is widened with its groups first, and a group that cannot mirror
 * refuses the whole action. Pieces stacked-connected to a run piece (a wall unit over its base, ADR-207) mirror too.
 */
export function mirrorRun(
  project: Project,
  id: string,
): { project: Project; reasons: string[]; refused?: string } {
  const run = withGroups(project, stackedWith(project, touchingRun(project, id)));
  if (!run.length) return { project, reasons: [] };
  // A run on a side wall mirrors along that wall (ADR-251, user 2026-11-10).
  const r = mirrorSet(project, run, runAxis(project, id));
  return r.refused ? { ...r, refused: t('Mirror the run refused: {why}', { why: r.refused }) } : r;
}

/**
 * Mirror several pieces together (ADR-069, ADR-121): positions reflect left–right about the centre of the space they
 * take, each piece's design is mirrored, and a piece's turn becomes −θ so its front faces the mirrored way. Pieces
 * resting on them follow, reflected over their base. Refused, naming the piece, when one is locked (ADR-095).
 */
export function mirrorSet(
  project: Project,
  ids: readonly string[],
  axis: 'x' | 'z' = 'x',
): { project: Project; reasons: string[]; refused?: string } {
  const bounds = boundsOf(project),
    outlines = outlinesOf(project);
  const set = ids.filter((i) => bounds.has(i));
  if (!set.length) return { project, reasons: [] };
  const inSet = new Set(set);
  // Pieces resting on a mirrored piece, at any depth (ADR-031), are mirrored with it.
  const stacked = new Set(
    carriedBy(project, set)
      .map((i) => i.id)
      .filter((i) => !inSet.has(i)),
  );
  // Every piece of the set and on it moves and is mirrored: refused when one is locked (ADR-095).
  // A mirror also turns each piece (θ → −θ): a turn lock refuses it too, as for one piece (ADR-171, ADR-243).
  const refused =
    moveBlocked(project, [...set, ...stacked]) ?? turnBlocked(project, [...set, ...stacked]);
  if (refused) return { project, reasons: [], refused };
  // Reflected about the centre of the space they take along `axis` (ADR-251: z for a run on a side wall).
  const lo = (b: Box) => (axis === 'x' ? b.x : b.z);
  const len = (b: Box) => (axis === 'x' ? b.w : b.d);
  const x0 = Math.min(...set.map((r) => lo(bounds.get(r)!))),
    x1 = Math.max(...set.map((r) => lo(bounds.get(r)!) + len(bounds.get(r)!)));
  const reasons: string[] = [];
  const items = project.items.map((it): ProjectItem => {
    if (!inSet.has(it.id) && !stacked.has(it.id)) return it;
    const m = mirrorDesign(it.design);
    if (!m.ok) reasons.push(`${it.design.name}: ${m.reason}`);
    const own = outlines.get(it.id)!;
    const pl = it.placement;
    const moved =
      stacked.has(it.id) && pl?.kind === 'above'
        ? {
            ...it,
            placement: {
              ...pl,
              offsetX: outlines.get(pl.baseId)!.w - (pl.offsetX + own.w),
            },
          }
        : axis === 'x'
          ? shifted(it, x0 + x1 - (own.x + own.w) - own.x, 0)
          : shifted(it, 0, x0 + x1 - (own.z + own.d) - own.z);
    // Reflected along x the turn becomes −θ; along z it becomes 180° − θ (the front keeps facing the same wall).
    const turn =
      axis === 'x'
        ? mirroredRotation(it)
        : splitRotation((((180 - rotationOf(it)) % 360) + 360) % 360)!;
    // −θ of an angled piece can need the other quarter (−20° is 270° + 70°): its outline swaps width and depth, so
    // keep its centre as `tryTurn` does, with the same rounding (mirroring twice gives the same place back).
    const half = (n: number) => (turn.rotationY % 180 === 0 ? Math.ceil(n / 2) : Math.floor(n / 2));
    const recentred =
      (turn.rotationY - it.rotationY) % 180 !== 0 && pl?.kind !== 'above'
        ? shifted(moved, half(own.w - own.d), half(own.d - own.w))
        : moved;
    const { angle: _angle, ...flat } = recentred;
    void _angle;
    return { ...flat, design: m.design, ...turn };
  });
  return { project: { ...project, items }, reasons };
}

/**
 * Duplicate, mirror and turn a piece about its centre in a project (ADR-069). Pure functions over the stored project:
 * nothing stored changes shape, every result is whole millimetres and quarter turns, and overlaps that result are left
 * to the usual diagnostics (ADR-008).
 */
import { newId } from './design';
import { overlaps } from './geometry';
import {
  carriedBy,
  LOCKED_HINT,
  mirroredRotation,
  moveBlocked,
  pieceName,
  placedBounds,
  placedOutline,
  quarterTurn,
  resolvePlacements,
  splitRotation,
  type MoveResult,
  type Project,
  type ProjectItem,
} from './project';
import { placedBox } from './panelset';
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
  }
  return out;
}

export type MirrorResult =
  { ok: true; design: Design } | { ok: false; design: Design; reason: string };

export const NOTHING_TO_MIRROR = 'Nothing to mirror in this piece';

/**
 * Swap left and right inside one piece (ADR-069): hinges, pedestal sides, corner side, the order of side-by-side
 * spaces and placed panels. Part sizes stay as they are, so the cut list keeps its rows. A piece with nothing handed
 * comes back unchanged with a reason.
 */
export function mirrorDesign(d: Design): MirrorResult {
  const prod = d.product;
  const same = (reason: string): MirrorResult => ({ ok: false, design: d, reason });
  const withProduct = (product: Product): MirrorResult => {
    const design = { ...d, product };
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
      // Built only at the left end today; mirroring them needs a stored side (left open in ADR-069).
      if (p.kind === 'bench' && p.backrest)
        return same('The lounger backrest is always at the left end; it cannot be mirrored yet');
      if (p.kind === 'bed' && p.bed && p.bed.sidePanelHeight > 0)
        return same('The daybed side panel is always on the left; it cannot be mirrored yet');
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
 * A copy of a piece with new ids (ADR-011), touching it on its right in the room's x, or on its left when the right
 * is taken and the left is free (otherwise on the right anyway; the overlap is the usual diagnostic). Same placement,
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
  const free = (x: number) => ![...bounds.values()].some((o) => overlaps(o, { ...b, x }));
  const right = b.x + b.w,
    left = b.x - b.w;
  const x = free(right) || !free(left) ? right : left;
  const src = project.items[at];
  // The copy is a new piece placed for the user: it starts unlocked (ADR-095) and not linked (ADR-111).
  const { locked: _locked, linkId: _link, ...unlocked } = structuredClone(src);
  void _locked;
  void _link;
  const copy: ProjectItem = {
    ...shifted(unlocked, x - b.x, 0),
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
  const reason = moveBlocked(project, [id]);
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
  if (!split) return { project, reason: 'Rotation must be whole degrees from 0 to 359.' };
  if (split.rotationY === it.rotationY && (split.angle ?? 0) === (it.angle ?? 0))
    return { project };
  const reason = moveBlocked(project, [id]);
  if (reason) return { project, reason };
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
  const m = mirrorDesign(it.design);
  if (!m.ok) return { project, reason: m.reason };
  return {
    project: {
      ...project,
      items: project.items.map((i) => (i.id === id ? { ...i, design: m.design } : i)),
    },
  };
}

/** Open-interval overlap of two spans. */
const spans = (a0: number, a1: number, b0: number, b1: number) =>
  Math.min(a1, b1) > Math.max(a0, b0);

/** The widest gap a run bridges, as for run parts and their fillers (ADR-036). */
export const RUN_GAP = 150;

/**
 * The run `id` is in: pieces at the same height and depth side by side along x, touching or with a filler gap of up
 * to 150 mm as for run parts (ADR-036), directly or through each other; sorted left to right. Always includes `id`
 * when it is in the project. `placed` may pass the placed bounds the project model already holds.
 */
export function touchingRun(project: Project, id: string, placed?: Map<string, Box>): string[] {
  const bounds = placed ?? boundsOf(project);
  if (!bounds.has(id)) return [];
  const near = (a: Box, b: Box) => {
    const gap = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
    return (
      gap >= 0 &&
      gap <= RUN_GAP &&
      spans(a.y, a.y + a.h, b.y, b.y + b.h) &&
      spans(a.z, a.z + a.d, b.z, b.z + b.d)
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
  return [...run].sort((a, b) => bounds.get(a)!.x - bounds.get(b)!.x);
}

/**
 * Mirror the run `id` is in (ADR-069): every piece's position reflects about the run's centre and each piece is
 * mirrored. Pieces resting on a run piece (and on those, at any depth) are mirrored too and keep their place over
 * their base, reflected. Pieces with nothing to mirror only move; `reasons` lists them.
 */
export function mirrorRun(
  project: Project,
  id: string,
): { project: Project; reasons: string[]; refused?: string } {
  const run = touchingRun(project, id);
  if (!run.length) return { project, reasons: [] };
  const r = mirrorSet(project, run);
  return r.refused ? { ...r, refused: `Mirror the run refused: ${r.refused}` } : r;
}

/**
 * Mirror several pieces together (ADR-069, ADR-121): positions reflect left–right about the centre of the space they
 * take, each piece's design is mirrored, and a piece's turn becomes −θ so its front faces the mirrored way. Pieces
 * resting on them follow, reflected over their base. Refused, naming the piece, when one is locked (ADR-095).
 */
export function mirrorSet(
  project: Project,
  ids: readonly string[],
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
  const refused = moveBlocked(project, [...set, ...stacked]);
  if (refused) return { project, reasons: [], refused };
  const x0 = Math.min(...set.map((r) => bounds.get(r)!.x)),
    x1 = Math.max(...set.map((r) => bounds.get(r)!.x + bounds.get(r)!.w));
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
        : shifted(it, x0 + x1 - (own.x + own.w) - own.x, 0);
    const { angle: _angle, ...flat } = moved;
    void _angle;
    return { ...flat, design: m.design, ...mirroredRotation(it) };
  });
  return { project: { ...project, items }, reasons };
}

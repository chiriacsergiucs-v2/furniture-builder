import type { Box, FurnitureModel, Mm, Panel, SpaceOpening } from './types';

/**
 * Tap selection from the outside in (ADR-083). `undefined` = nothing selected, `null` = the whole piece, a string =
 * that space.
 */
export type Selection = string | null | undefined;

const inside = (s: SpaceOpening, x: Mm, y: Mm) =>
  x >= s.box.x && x <= s.box.x + s.box.w && y >= s.box.y && y <= s.box.y + s.box.h;

/**
 * Space ids from the outermost to the innermost front-view space containing the point (piece mm, x and y). A lone
 * divided root (a cabinet's interior) is the whole piece again, so it is left out.
 */
export function pathAt(model: FurnitureModel, x: Mm, y: Mm): string[] {
  const front = model.spaces.filter((s) => s.view !== 'side');
  const roots = front.filter((s) => s.depth === 0);
  const skipRoot = roots.length === 1 && !roots[0].leaf;
  const path: string[] = [];
  for (const s of front.filter((o) => inside(o, x, y)).sort((a, b) => a.depth - b.depth)) {
    if (s.depth !== path.length + (skipRoot ? 1 : 0)) continue;
    path.push(s.nodeId);
  }
  return path;
}

/** The selection after a tap at (x, y): whole piece first, then one level smaller per tap, then the whole piece again. */
export function drill(model: FurnitureModel, x: Mm, y: Mm, current: Selection): Selection {
  const b = model.bounds;
  if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) return undefined;
  if (current === undefined) return null;
  const full: (string | null)[] = [null, ...pathAt(model, x, y)];
  const at = full.indexOf(current);
  if (at >= 0) return at + 1 < full.length ? full[at + 1] : null;
  // A tap elsewhere: go to where the two paths part, then one level down (a sibling bay, not the whole piece).
  const sel = model.spaces.find((s) => s.nodeId === current && s.view !== 'side');
  if (!sel) return full[1] ?? null;
  const own = [null, ...pathAt(model, sel.box.x + sel.box.w / 2, sel.box.y + sel.box.h / 2)];
  let k = 0;
  while (k + 1 < full.length && full[k + 1] === own[k + 1]) k++;
  return full[k + 1] ?? null;
}

/**
 * The box the selection look draws round (ADR-087), the same one the quick-count card anchors on: the piece's bounds
 * for the whole piece, the space's front-view box for a space, nothing when nothing is selected.
 */
export function selectionBox(model: FurnitureModel, sel: Selection): Box | undefined {
  if (sel === null) return model.bounds;
  if (sel === undefined) return undefined;
  return model.spaces.find((s) => s.nodeId === sel && s.view !== 'side')?.box;
}

/** Whether a panel belongs to the selected box: its front-view centre is inside (ADR-087); the rest is faded. */
export function inSelection(sel: Box, p: Box): boolean {
  const cx = p.x + p.w / 2,
    cy = p.y + p.h / 2;
  return cx >= sel.x && cx <= sel.x + sel.w && cy >= sel.y && cy <= sel.y + sel.h;
}

/**
 * A 3D hit (metres, the viewer's 1 unit = 1 m) as model mm. In the exploded view panels sit away from their place, so
 * the tapped panel's built centre stands in for the hit point.
 */
export function hitToMm(
  hit: { x: number; y: number; z: number },
  built: Panel | undefined,
  exploded: boolean,
): { x: Mm; y: Mm; z: Mm } {
  if (exploded && built) {
    const b = built.box;
    return {
      x: Math.round(b.x + b.w / 2),
      y: Math.round(b.y + b.h / 2),
      z: Math.round(b.z + b.d / 2),
    };
  }
  return { x: Math.round(hit.x * 1000), y: Math.round(hit.y * 1000), z: Math.round(hit.z * 1000) };
}

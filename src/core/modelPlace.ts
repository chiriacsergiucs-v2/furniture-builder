/**
 * Placing display-only 3D models (ADR-208, G-040): dragging one on the plan or in Move mode goes the way a piece does
 * (ADR-065, ADR-070, ADR-093): whole mm, the 10 mm step with Snap off or Alt held, and with Snap on its sides snap to
 * the walls, the pieces' faces and the other models' sides within `SNAP_RANGE`. A model on a piece is lifted off to
 * the floor when dragged; one on the wall keeps its height. Pure; never throws, never clamps (ADR-008).
 */
import { t } from './i18n';
import { modelBox, type ModelItem, type ModelPlacement } from './model3d';
import { DRAG_STEP, type PlacedPiece, type Project } from './project';
import { mountOf, pieceConnectors, roomConnectors, SNAP_RANGE, type Axis } from './snap';
import type { Box, Mm } from './types';

interface ModelDrop {
  position: ModelItem['position'];
  /** Its box there, for the preview. */
  box: Box;
  /** What it snapped to ("Against wall 1 · Joins Base 600"), or null. */
  snap: string | null;
  /** With Snap on and nothing near: why it did not snap. */
  hint: string | null;
}

/** A model dragged off a piece lands on the floor (ADR-065's lift-off); other placements stay. */
export function liftModel(pl: ModelPlacement | undefined): ModelPlacement | undefined {
  return pl?.kind === 'above' ? { kind: 'floor' } : pl;
}

/** The height a dragged model lands at: 0 when lifted off a piece, else where it is. */
const modelLandingY = (m: ModelItem): Mm => (m.placement?.kind === 'above' ? 0 : m.position.y);

interface Face {
  axis: Axis;
  at: number;
  normal: 1 | -1;
  lo: number;
  hi: number;
  label: string;
}

const boxFaces = (b: Box, label: string): Face[] => [
  { axis: 'x', at: b.x, normal: -1, lo: b.z, hi: b.z + b.d, label },
  { axis: 'x', at: b.x + b.w, normal: 1, lo: b.z, hi: b.z + b.d, label },
  { axis: 'z', at: b.z, normal: -1, lo: b.x, hi: b.x + b.w, label },
  { axis: 'z', at: b.z + b.d, normal: 1, lo: b.x, hi: b.x + b.w, label },
];
const span = (f: { lo: number; hi: number }, g: { lo: number; hi: number }) =>
  Math.min(f.hi, g.hi) - Math.max(f.lo, g.lo);
const stepped = (d: number) =>
  (Number.isFinite(d) ? Math.round(d / DRAG_STEP) * DRAG_STEP : 0) || 0;

/**
 * Where model `id` lands when dragged `dx`, `dz` plan mm. With `snap`, each plan axis snaps on its own to the nearest
 * wall, piece face or other model side facing it within `range` (a wall wins a tie).
 */
export function modelDrop(
  project: Project,
  pieces: PlacedPiece[],
  id: string,
  dx: number,
  dz: number,
  snap: boolean,
  range: Mm = SNAP_RANGE,
): ModelDrop | null {
  const m = project.models?.find((x) => x.id === id);
  if (!m) return null;
  const fx = m.position.x + stepped(dx),
    fz = m.position.z + stepped(dz);
  const y = modelLandingY(m);
  const at = (mx = 0, mz = 0): Box => modelBox({ ...m, position: { x: fx + mx, y, z: fz + mz } });
  const result = (mx: number, mz: number, label: string | null, hint: string | null) => ({
    position: { x: fx + mx, y, z: fz + mz },
    box: at(mx, mz),
    snap: label,
    hint,
  });
  if (!snap) return result(0, 0, null, null);
  const mine = boxFaces(at(), '');
  const walls: Face[] = roomConnectors(project.room).walls.map((w) => ({
    ...w,
    label: w.wall < 0 ? t('the back wall') : t('wall {n}', { n: w.wall + 1 }),
  }));
  const pieceFaces: Face[] = pieces.flatMap((pc) =>
    pieceConnectors(pc, mountOf(pc.item)).map((f) => ({ ...f, label: f.name })),
  );
  const modelFaces: Face[] = (project.models ?? [])
    .filter((o) => o.id !== id)
    .flatMap((o) => boxFaces(modelBox(o), o.name));
  const best: Record<Axis, { d: number; label: string; wall: boolean } | null> = {
    x: null,
    z: null,
  };
  const lists: [Face[], boolean][] = [
    [walls, true],
    [pieceFaces, false],
    [modelFaces, false],
  ];
  for (const f of mine)
    for (const [list, wall] of lists)
      for (const n of list) {
        if (n.axis !== f.axis || n.normal !== -f.normal || span(f, n) <= 0) continue;
        const d = n.at - f.at;
        if (Math.abs(d) > range) continue;
        const cur = best[f.axis];
        if (
          !cur ||
          Math.abs(d) < Math.abs(cur.d) ||
          (Math.abs(d) === Math.abs(cur.d) && wall && !cur.wall)
        )
          best[f.axis] = {
            d,
            label: wall
              ? t('Against {wall}', { wall: n.label })
              : t('Joins {name}', { name: n.label }),
            wall,
          };
      }
  const labels = [best.x?.label, best.z?.label].filter((l): l is string => !!l);
  if (!labels.length)
    return result(0, 0, null, t('Nothing to snap to within {range} mm.', { range }));
  return result(Math.round(best.x?.d ?? 0), Math.round(best.z?.d ?? 0), labels.join(' · '), null);
}

/** The project with model `id` at `position`, lifted off a piece; the same project when nothing moves. */
export function moveModelTo(
  project: Project,
  id: string,
  position: ModelItem['position'],
): Project {
  const models = project.models;
  const m = models?.find((x) => x.id === id);
  if (!models || !m) return project;
  if (position.x === m.position.x && position.z === m.position.z && position.y === m.position.y)
    return project;
  const placement = liftModel(m.placement);
  const { placement: _old, ...rest } = m;
  void _old;
  const moved: ModelItem = { ...rest, position, ...(placement ? { placement } : {}) };
  return { ...project, models: models.map((x) => (x.id === id ? moved : x)) };
}

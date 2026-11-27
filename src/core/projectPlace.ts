/** A project piece placed in the room: quarter turns, angles, cut outlines and bounds (G-548 split, ADR-306). */
import { buildModel } from './build';
import { localClearances, type Clearance } from './clearance';
import { envelopesOf, type Envelope } from './envelopes';
import { featureBox, isService, type Room } from './room';
import type { Placement } from './placement';
import { DEFAULT_MOUNT_HEIGHT, newId, upgradeDesign } from './design';
import {
  enclosing,
  footprintOf,
  inPlaneAxes,
  overlaps,
  sizeOn,
  startOn,
  union,
  yawPoint,
} from './geometry';
import { commonDesign, commonTopRole, type CommonBuild } from './common';
import { sharedDesign, withSharedPins, type SharedBuild } from './shared';
import { aabbOf, area2, turnShape } from './shape';
import type {
  Box,
  Design,
  Face,
  FurnitureModel,
  Mm,
  Panel,
  PanelShape,
  PinRows,
  Yaw,
} from './types';
import { type QuarterTurn, type ProjectItem, isWallHung, type Project } from './projectDoc';

// ---------------------------------------------------------------------------
// Quarter-turn placement
// ---------------------------------------------------------------------------

const ROT_FACE: Record<QuarterTurn, Record<Face, Face>> = {
  0: { '+x': '+x', '-x': '-x', '+y': '+y', '-y': '-y', '+z': '+z', '-z': '-z' },
  90: { '+z': '+x', '-z': '-x', '+x': '-z', '-x': '+z', '+y': '+y', '-y': '-y' },
  180: { '+x': '-x', '-x': '+x', '+z': '-z', '-z': '+z', '+y': '+y', '-y': '-y' },
  270: { '+z': '-x', '-z': '+x', '+x': '+z', '-x': '-z', '+y': '+y', '-y': '-y' },
};

/** Rotate a box about the origin (no translation): exact in integers. */
export function rotateBox(b: Box, r: QuarterTurn): Box {
  switch (r) {
    case 0:
      return b;
    case 90:
      return { x: b.z, y: b.y, z: -(b.x + b.w), w: b.d, h: b.h, d: b.w };
    case 180:
      return { x: -(b.x + b.w), y: b.y, z: -(b.z + b.d), w: b.w, h: b.h, d: b.d };
    case 270:
      return { x: -(b.z + b.d), y: b.y, z: b.x, w: b.d, h: b.h, d: b.w };
  }
}

/** A plan point (x, z) turned as `rotateBox` turns a box. */
function rotatePoint([x, z]: [Mm, Mm], r: QuarterTurn): [Mm, Mm] {
  return r === 90 ? [z, -x] : r === 180 ? [-x, -z] : r === 270 ? [-z, x] : [x, z];
}

const FACING: Record<QuarterTurn, PlacedPiece['facing']> = {
  0: { axis: 'z', sign: 1 },
  90: { axis: 'x', sign: 1 },
  180: { axis: 'z', sign: -1 },
  270: { axis: 'x', sign: -1 },
};

const swap = (a: Panel['thicknessAxis'], r: QuarterTurn) =>
  r % 180 === 0 ? a : a === 'x' ? 'z' : a === 'z' ? 'x' : 'y';

export interface PlacedPiece {
  item: ProjectItem;
  model: FurnitureModel;
  panels: Panel[];
  bounds: Box;
  /** Space its doors, drawers and flaps need to open, in room coordinates (ADR-057). */
  clearances: Clearance[];
  /** The room axis and sign the piece's front faces: its clearances grow that way. */
  facing: { axis: 'x' | 'z'; sign: 1 | -1 };
  /** Chair, installation and service envelopes in room coordinates (ADR-073). */
  envelopes: Envelope[];
  /** Its own tops (bottoms) a common top (bottom) replaces (ADR-165), in room coordinates; absent = none. */
  removed?: Panel[];
  /** The whole piece as one box, turned when the piece is typed at an angle (ADR-121); `bounds` encloses it. */
  outline: Box;
  /** Its floor outline: four corners (x, z) in order, turned with the piece (ADR-121). */
  footprint: [number, number][];
  /** The front edge on the floor, x1 z1 x2 z2 (ADR-121). */
  front: [number, number, number, number];
  /** The pipes and outlets its back is cut around (ADR-205), feature ids; absent = none. */
  backCut?: string[];
}

/** Which corners of `footprintOf` (back-left, back-right, front-right, front-left when unturned) carry the front. */
const FRONT_CORNERS: Record<QuarterTurn, [number, number]> = {
  0: [3, 2],
  90: [1, 2],
  180: [0, 1],
  270: [0, 3],
};

/**
 * A room point (mm) back in the piece's own coordinates, undoing its quarter turn and position as `placeItem` applies
 * them (ADR-083: a tap in the project selects the space under it).
 */
export function roomToPiece(
  item: ProjectItem,
  pt: { x: Mm; y: Mm; z: Mm },
): { x: Mm; y: Mm; z: Mm } {
  const built = buildModel(item.design);
  const r = item.rotationY;
  const rb = union(built.panels.map((p) => rotateBox(aabbOf(p), r)));
  // An angled piece (ADR-121): turn the point back about the piece's centre first.
  const yaw = yawOf(item, rb);
  if (yaw) {
    const [x, z] = yawPoint({ ...yaw, deg: -yaw.deg }, pt.x, pt.z);
    pt = { x, y: pt.y, z };
  }
  const back = rotateBox(
    {
      x: pt.x - item.position.x + rb.x,
      y: pt.y - item.position.y + rb.y,
      z: pt.z - item.position.z + rb.z,
      w: 0,
      h: 0,
      d: 0,
    },
    ((360 - r) % 360) as QuarterTurn,
  );
  return { x: back.x, y: back.y, z: back.z };
}

/** Build one item and move its panels into the room. Panel and node ids are prefixed with the item id. */
/**
 * A box in the piece's own mm (a selected space, ADR-088) placed in the room like the piece's panels: turned and moved
 * the same way as `placeItem` does. `built` is the piece's model (`buildModel(item.design)`).
 */
export function pieceBoxToRoom(item: ProjectItem, built: FurnitureModel, box: Box): Box {
  const r = item.rotationY;
  const rb = union(built.panels.map((p) => rotateBox(aabbOf(p), r)));
  const t = rotateBox(box, r);
  return withYaw(item, rb, {
    ...t,
    x: t.x + item.position.x - rb.x,
    y: t.y + item.position.y - rb.y,
    z: t.z + item.position.z - rb.z,
  });
}

/** The yaw of an angled piece (ADR-121): about the centre of its quarter-turned outline `rb` placed at `position`. */
function yawOf(item: ProjectItem, rb: Pick<Box, 'w' | 'd'>): Yaw | undefined {
  return item.angle
    ? { deg: item.angle, cx: item.position.x + rb.w / 2, cz: item.position.z + rb.d / 2 }
    : undefined;
}

const withYaw = (item: ProjectItem, rb: Pick<Box, 'w' | 'd'>, b: Box): Box => {
  const yaw = yawOf(item, rb);
  return yaw ? { ...b, yaw } : b;
};

/** How `placeItem` builds a piece: inside a run plinth, a common top or bottom, shared sides, a room. */
interface PlaceOptions {
  noPlinth?: boolean;
  common?: CommonBuild;
  shared?: SharedBuild;
  sharedPins?: PinRows[];
  /** The room, for backs cut around its pipes and outlets (ADR-205). */
  room?: Room;
}

/**
 * Placed pieces by item and by the options they were built with (ADR-221). Items are immutable store snapshots, so the
 * item object is a valid key; an entry goes with its item. Never mutate an item or a placed piece in place.
 */
const placed = new WeakMap<ProjectItem, Map<string, PlacedPiece>>();

/** The options `placeItem` reads, as a string: the same key means the same result for the same item. */
function placeKey(item: ProjectItem, opts: PlaceOptions | undefined): string {
  if (!opts) return '';
  return [
    opts.noPlinth ? 'n' : '',
    opts.common ? `c${JSON.stringify(opts.common)}` : '',
    opts.shared ? `s${JSON.stringify(opts.shared)}` : '',
    opts.sharedPins?.length ? `p${JSON.stringify(opts.sharedPins)}` : '',
    // The room is read only for backs cut around its pipes and outlets.
    item.backCuts?.length && opts.room ? `r${JSON.stringify(opts.room)}` : '',
  ]
    .filter(Boolean)
    .join('|');
}

/** Build one item and move its panels into the room, once per item and options (ADR-221). */
export function placeItem(item: ProjectItem, opts?: PlaceOptions): PlacedPiece {
  const key = placeKey(item, opts);
  let byKey = placed.get(item);
  const hit = byKey?.get(key);
  if (hit) return hit;
  const pc = placeItemOnce(item, opts);
  if (!byKey) placed.set(item, (byKey = new Map()));
  byKey.set(key, pc);
  return pc;
}

function placeItemOnce(item: ProjectItem, opts: PlaceOptions | undefined): PlacedPiece {
  const c = opts?.common;
  // In a common top or bottom (ADR-165) the piece is built with its top over (bottom under) the sides; sharing a
  // side (ADR-190) it leaves its right side out and its left side carries the neighbour's pin rows.
  const raw = buildModel(
    sharedDesign(c ? commonDesign(item.design, c) : item.design, opts?.shared),
  );
  const pinned = opts?.sharedPins?.length
    ? { ...raw, panels: withSharedPins(raw.panels, opts.sharedPins) }
    : raw;
  // A back cut around a pipe or outlet (ADR-205) is a profiled part, turned with the piece below.
  const cuts = item.backCuts?.length
    ? backCutsOf(
        item,
        pinned.panels,
        opts?.shared?.right ? buildModel(item.design).panels : pinned.panels,
        opts?.room,
      )
    : { shapes: new Map<string, PanelShape>(), features: [] };
  const built = cuts.shapes.size
    ? {
        ...pinned,
        panels: pinned.panels.map((p) =>
          cuts.shapes.has(p.id) ? { ...p, shape: cuts.shapes.get(p.id) } : p,
        ),
      }
    : pinned;
  // A run plinth replaces the piece's own plinth (ADR-054); a common top or bottom replaces its own (ADR-165).
  const leaves = (p: Panel) =>
    (!!opts?.noPlinth && p.role === 'plinth') ||
    (!!c?.top && p.role === commonTopRole(item.design)) ||
    (!!c?.bottom && p.role === 'bottom');
  const model = built.panels.some(leaves)
    ? { ...built, panels: built.panels.filter((p) => !leaves(p)) }
    : built;
  const r = item.rotationY;
  const left = model === built ? [] : built.panels.filter((p) => leaves(p) && p.role !== 'plinth');
  const rotated = [...model.panels, ...left].map((p) => rotateBox(p.box, r));
  // The piece is placed by its full outline, so leaving the plinth out does not move it.
  // Sharing a side (ADR-190) a front reaches over half the neighbour's side; the piece keeps its own outline.
  const own = opts?.shared?.right ? buildModel(item.design).panels : built.panels;
  const rb = union(own.map((p) => rotateBox(aabbOf(p), r)));
  const dx = item.position.x - rb.x,
    dy = item.position.y - rb.y,
    dz = item.position.z - rb.z;
  const all = [...model.panels, ...left].map((p, i): Panel => ({
    ...p,
    id: `${item.id}:${p.id}`,
    nodeId: `${item.id}:${p.nodeId}`,
    box: withYaw(item, rb, {
      ...rotated[i],
      x: rotated[i].x + dx,
      y: rotated[i].y + dy,
      z: rotated[i].z + dz,
    }),
    thicknessAxis: swap(p.thicknessAxis, r),
    grainAxis: swap(p.grainAxis, r),
    banded: p.banded.map((f) => ROT_FACE[r][f]),
    ...(p.pinRows ? { pinRows: p.pinRows.map((x) => ({ ...x, face: ROT_FACE[r][x.face] })) } : {}),
    ...(p.shape
      ? {
          shape: turnShape(
            p.shape,
            p.box,
            rotated[i],
            p.thicknessAxis,
            swap(p.thicknessAxis, r),
            r,
          ),
        }
      : {}),
  }));
  const panels = all.slice(0, model.panels.length);
  const full = { x: rb.x + dx, y: rb.y + dy, z: rb.z + dz, w: rb.w, h: rb.h, d: rb.d };
  const clearances = localClearances(model).map((c): Clearance => {
    const rc = rotateBox(c.box, r);
    const { arc, ...rest } = c;
    // The swing's hinge turns and moves with the piece (G-011); a piece typed at an angle keeps the box.
    const pivot = arc && !item.angle ? rotatePoint(arc.pivot, r) : null;
    return {
      ...rest,
      panelId: `${item.id}:${c.panelId}`,
      box: withYaw(item, rb, { ...rc, x: rc.x + dx, y: rc.y + dy, z: rc.z + dz }),
      ...(arc && pivot ? { arc: { pivot: [pivot[0] + dx, pivot[1] + dz], r2: arc.r2 } } : {}),
    };
  });
  const facing = FACING[r];
  // Tipped up in place from lying on its back: stands on the floor, not hung and not set on another piece (ADR-073).
  const standsUp =
    item.position.y === 0 && item.placement?.kind !== 'above' && !isWallHung(item.design);
  const envelopes = envelopesOf(item.design, item.zones, standsUp, built).map((e) => {
    const rc = rotateBox(e.box, r);
    return { ...e, box: withYaw(item, rb, { ...rc, x: rc.x + dx, y: rc.y + dy, z: rc.z + dz }) };
  });
  // The outline on the floor and the front edge, turned with the piece (ADR-121), for the plan and room checks.
  const outline = withYaw(item, rb, full);
  const corners = footprintOf(outline);
  const [f1, f2] = FRONT_CORNERS[r];
  return {
    item,
    model,
    panels,
    bounds:
      model === built && !opts?.shared?.right ? union(panels.map(aabbOf)) : enclosing(outline),
    clearances,
    facing,
    envelopes,
    outline,
    footprint: corners,
    front: [...corners[f1], ...corners[f2]] as [number, number, number, number],
    ...(left.length ? { removed: all.slice(model.panels.length) } : {}),
    ...(cuts.features.length ? { backCut: cuts.features } : {}),
  };
}

// ---------------------------------------------------------------------------
// Backs cut around a pipe or outlet (ADR-205)
// ---------------------------------------------------------------------------

/**
 * A board's outline with rectangular cut-outs taken away (ADR-205), in whole mm on its face (`w` × `h`): the outline
 * and the holes left, or null when nothing or more than one piece is left (the cut-outs would split it). A cut-out that
 * reaches an edge makes a notch in the outline; one inside the board makes a hole.
 */
function cutOutline(
  w: Mm,
  h: Mm,
  rects: { u: Mm; v: Mm; w: Mm; h: Mm }[],
): { points: [Mm, Mm][]; holes: [Mm, Mm][][] } | null {
  const xs = [...new Set([0, w, ...rects.flatMap((r) => [r.u, r.u + r.w])])].sort((a, b) => a - b);
  const ys = [...new Set([0, h, ...rects.flatMap((r) => [r.v, r.v + r.h])])].sort((a, b) => a - b);
  const solid = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= xs.length - 1 || j >= ys.length - 1) return false;
    const cx = (xs[i] + xs[i + 1]) / 2,
      cy = (ys[j] + ys[j + 1]) / 2;
    return !rects.some((r) => cx > r.u && cx < r.u + r.w && cy > r.v && cy < r.v + r.h);
  };
  // The boundary as directed edges, the solid on their left (counter-clockwise outside, clockwise round holes).
  const next = new Map<string, [Mm, Mm][]>();
  const key = (p: [Mm, Mm]) => `${p[0]},${p[1]}`;
  const edge = (a: [Mm, Mm], b: [Mm, Mm]) => {
    const list = next.get(key(a));
    if (list) list.push(b);
    else next.set(key(a), [b]);
  };
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++) {
      if (!solid(i, j)) continue;
      const [x0, x1, y0, y1] = [xs[i], xs[i + 1], ys[j], ys[j + 1]];
      if (!solid(i, j - 1)) edge([x0, y0], [x1, y0]);
      if (!solid(i + 1, j)) edge([x1, y0], [x1, y1]);
      if (!solid(i, j + 1)) edge([x1, y1], [x0, y1]);
      if (!solid(i - 1, j)) edge([x0, y1], [x0, y0]);
    }
  const loops: [Mm, Mm][][] = [];
  for (const [start] of next) {
    while (next.get(start)?.length) {
      const loop: [Mm, Mm][] = [];
      let at = start;
      for (let guard = 0; guard < 10000; guard++) {
        const outs = next.get(at);
        if (!outs?.length) break;
        const to = outs.shift()!;
        loop.push(at.split(',').map(Number) as [Mm, Mm]);
        at = key(to);
        if (at === start) break;
      }
      // Corners only: points in a straight line between their neighbours are left out.
      const pts = loop.filter((p, k) => {
        const a = loop[(k - 1 + loop.length) % loop.length],
          b = loop[(k + 1) % loop.length];
        return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
      });
      if (pts.length >= 3) loops.push(pts);
    }
  }
  const outer = loops.filter((l) => area2(l) > 0);
  if (outer.length !== 1) return null;
  return { points: outer[0], holes: loops.filter((l) => area2(l) < 0) };
}

/**
 * The backs of a piece cut around the pipes and outlets the user asked for (`backCuts`, ADR-205), by panel id in the
 * piece's own coordinates: a profile with a cut-out exactly the size of the zone typed in the room (no clearance
 * added), a notch where the zone reaches an edge of the back, otherwise a hole. `panels` are the piece's built parts and
 * `own` the parts its outline is placed by (as `placeItem`). A piece typed at an angle is not cut (the repair says why);
 * neither is a back already shaped, nor one the cut-outs would split. `features`: the pipes and outlets cut round.
 */
function backCutsOf(
  item: ProjectItem,
  panels: Panel[],
  own: Panel[],
  room: Room | undefined,
): { shapes: Map<string, PanelShape>; features: string[] } {
  const shapes = new Map<string, PanelShape>();
  const features: string[] = [];
  if (!item.backCuts?.length || !room || item.angle || !own.length) return { shapes, features };
  const r = item.rotationY;
  const rb = union(own.map((p) => rotateBox(aabbOf(p), r)));
  const [dx, dy, dz] = [item.position.x - rb.x, item.position.y - rb.y, item.position.z - rb.z];
  const undo = ((360 - r) % 360) as QuarterTurn;
  const rects = new Map<string, { u: Mm; v: Mm; w: Mm; h: Mm }[]>();
  const by = new Map<string, string[]>();
  for (const fid of item.backCuts) {
    const f = room.features.find((x) => x.id === fid && isService(x.kind));
    const zone = f ? featureBox(room, f) : null;
    if (!zone) continue;
    const local = rotateBox({ ...zone, x: zone.x - dx, y: zone.y - dy, z: zone.z - dz }, undo);
    for (const p of panels) {
      if (p.role !== 'back' || p.shape || !overlaps(p.box, local)) continue;
      const [ua, va] = inPlaneAxes(p.thicknessAxis);
      const W = sizeOn(p.box, ua),
        H = sizeOn(p.box, va);
      const u0 = Math.max(0, startOn(local, ua) - startOn(p.box, ua)),
        u1 = Math.min(W, startOn(local, ua) + sizeOn(local, ua) - startOn(p.box, ua));
      const v0 = Math.max(0, startOn(local, va) - startOn(p.box, va)),
        v1 = Math.min(H, startOn(local, va) + sizeOn(local, va) - startOn(p.box, va));
      if (u1 <= u0 || v1 <= v0) continue;
      rects.set(p.id, [...(rects.get(p.id) ?? []), { u: u0, v: v0, w: u1 - u0, h: v1 - v0 }]);
      by.set(p.id, [...(by.get(p.id) ?? []), fid]);
    }
  }
  for (const p of panels) {
    const list = rects.get(p.id);
    if (!list) continue;
    const [ua, va] = inPlaneAxes(p.thicknessAxis);
    const cut = cutOutline(sizeOn(p.box, ua), sizeOn(p.box, va), list);
    if (!cut) continue;
    shapes.set(p.id, {
      kind: 'profile',
      points: cut.points,
      ...(cut.holes.length ? { holes: cut.holes } : {}),
      cutouts: list,
    });
    for (const fid of by.get(p.id)!) if (!features.includes(fid)) features.push(fid);
  }
  return { shapes, features };
}

export const placedBounds = (item: ProjectItem): Box => placeItem(item).bounds;

/**
 * The piece as one box before its extra angle (ADR-121): `position` is its lowest corner and it shares its centre with
 * `placedBounds`. The same box as `placedBounds` for a piece at a quarter turn.
 */
export function placedOutline(item: ProjectItem): Box {
  const { yaw: _yaw, ...flat } = placeItem(item).outline;
  void _yaw;
  return flat;
}

/** A copy of a design as a new project item, placed to the right of what is already there. */
export function makeItem(project: Project, design: Design, libraryId?: string): ProjectItem {
  const right = project.items.length
    ? Math.max(...project.items.map((i) => placedBounds(i).x + placedBounds(i).w))
    : 0;
  const d = upgradeDesign(design);
  const wall = isWallHung(d);
  const y = wall
    ? d.product.kind === 'cabinet' || d.product.kind === 'corner'
      ? (d.product.params.mountHeight ?? DEFAULT_MOUNT_HEIGHT)
      : DEFAULT_MOUNT_HEIGHT
    : 0;
  const placement: Placement = wall ? { kind: 'wall', height: y } : { kind: 'floor' };
  return {
    id: newId(),
    design: structuredClone(d),
    quantity: 1,
    position: { x: right, y, z: 0 },
    rotationY: 0,
    placement,
    ...(libraryId ? { libraryId } : {}),
    // A catalog piece refers to its template (ADR-124); the copy stays as the fallback.
    ...(d.catalog?.origin ? { ref: { overrides: {} } } : {}),
  };
}

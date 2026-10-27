import { buildCabinet, hingeBand, hingeCount, type PartialModel } from './cabinet';
import { box, equalParts } from './geometry';
import type {
  Box,
  CabinetParams,
  CornerParams,
  Face,
  Material,
  Panel,
  SpaceOpening,
} from './types';

/**
 * Corner cabinets (ADR-025), built from two carcasses by the cabinet generator — no shelf, drawer or front code of
 * their own.
 *
 * Blind corner: a narrow blind section (empty carcass + fixed blind panel in front) joined to a normal cabinet.
 * L-shape: wing A along the back wall and wing B along the side wall, open to each other at the corner (B has no
 * side there), one door on each wing; A's door starts clear of B's door so the two leaves can fold together.
 * Both are drawn for the corner on the left and mirrored for `side: 'right'`.
 */

const lo = (n: number) => Math.floor(n / 2);

function carcass(
  p: CornerParams,
  width: number,
  interior: CabinetParams['interior'],
): CabinetParams {
  return {
    width,
    height: p.height,
    depth: p.depth,
    bodyMaterialId: p.bodyMaterialId,
    frontMaterialId: p.frontMaterialId,
    backMaterialId: p.backMaterialId,
    top: p.top,
    ...(p.topLayers === 2 ? { topLayers: 2 as const } : {}),
    back: p.back,
    backInset: p.backInset,
    plinthHeight: p.plinthHeight,
    plinthSetback: p.plinthSetback,
    frontGap: p.frontGap,
    shelfSetback: p.shelfSetback,
    drawers: p.drawers,
    interior,
  };
}

const FACE_ROT: Record<Face, Face> = {
  '+z': '+x',
  '-z': '-x',
  '+x': '-z',
  '-x': '+z',
  '+y': '+y',
  '-y': '-y',
};
const FACE_MIRROR: Record<Face, Face> = {
  '+x': '-x',
  '-x': '+x',
  '+y': '+y',
  '-y': '-y',
  '+z': '+z',
  '-z': '-z',
};
const swapXZ = (a: Panel['thicknessAxis']) => (a === 'x' ? 'z' : a === 'z' ? 'x' : 'y');

/** Quarter turn for wing B: local depth → world x, local width → world z running from `zEnd` back towards the corner. */
function rotateBox(b: Box, zEnd: number): Box {
  return { x: b.z, y: b.y, z: zEnd - (b.x + b.w), w: b.d, h: b.h, d: b.w };
}
const rotatePanel = (p: Panel, zEnd: number): Panel => ({
  ...p,
  box: rotateBox(p.box, zEnd),
  thicknessAxis: swapXZ(p.thicknessAxis),
  grainAxis: swapXZ(p.grainAxis),
  banded: p.banded.map((f) => FACE_ROT[f]),
  ...(p.pinRows ? { pinRows: p.pinRows.map((r) => ({ ...r, face: FACE_ROT[r.face] })) } : {}),
});

const mirrorBox = (b: Box, W: number): Box => ({ ...b, x: W - (b.x + b.w) });
const swapLR = (label: string) =>
  label.replace(/\bLeft\b|\bRight\b/g, (m) => (m === 'Left' ? 'Right' : 'Left'));
function mirror(m: PartialModel, W: number): PartialModel {
  return {
    ...m,
    panels: m.panels.map((p) => ({
      ...p,
      label: swapLR(p.label),
      box: mirrorBox(p.box, W),
      banded: p.banded.map((f) => FACE_MIRROR[f]),
      ...(p.pinRows
        ? { pinRows: p.pinRows.map((r) => ({ ...r, face: FACE_MIRROR[r.face] })) }
        : {}),
      // Mirroring flips which edge is the front's left, for fronts facing ±z (width along x) and ±x (width along z).
      ...(p.handleHoles
        ? {
            handleHoles: {
              ...p.handleHoles,
              at: p.handleHoles.at.map(
                ([u, v]) =>
                  [(p.thicknessAxis === 'z' ? p.box.w : p.box.d) - u, v] as [number, number],
              ),
            },
          }
        : {}),
    })),
    spaces: m.spaces.map((s) => ({ ...s, box: mirrorBox(s.box, W) })),
  };
}

const merge = (into: PartialModel, from: PartialModel) => {
  into.panels.push(...from.panels);
  into.spaces.push(...from.spaces);
  into.hardware.push(...from.hardware);
  into.diagnostics.push(...from.diagnostics);
};

/**
 * Diagonal corner (ADR-040), corner on the left: backs on both walls, a side return at the end of each wall (`depth`
 * deep), five-sided bottom, top and shelves (profiled boards), a plinth board and the door(s) turned 45° about the
 * vertical across the diagonal. Mirrored for `side: 'right'`.
 */
function buildDiagonal(
  p: CornerParams,
  id: string,
  materials: Map<string, Material>,
  out: PartialModel,
): PartialModel {
  const err = (code: string, message: string) => {
    out.diagnostics.push({ severity: 'error', code, message, nodeId: id });
    return out;
  };
  const body = materials.get(p.bodyMaterialId)!,
    front = materials.get(p.frontMaterialId)!,
    backM = materials.get(p.backMaterialId);
  if (!backM)
    return err(
      'material-missing',
      'A material used by this corner cabinet does not exist in the design.',
    );
  const W = p.width,
    D = p.depth,
    H = p.height,
    t = body.thickness,
    tf = front.thickness,
    ph = p.plinthHeight,
    g = p.frontGap;
  const bt = p.back === 'none' ? 0 : backM.thickness;
  const s = p.interior;
  if (s.kind !== 'shelves')
    return err(
      'diagonal-interior',
      'A diagonal corner holds shelves only; set its inside to shelves.',
    );
  if (W - D < 300)
    return err(
      'corner-size',
      `The diagonal needs the width (${W} mm) at least 300 mm more than the depth (${D} mm).`,
    );
  if (D < 3 * t + 100 || H - ph < 4 * t)
    return err(
      'corner-size',
      `A ${W} × ${H} × ${D} mm diagonal corner is too small for ${t} mm panels.`,
    );
  const local: PartialModel = { panels: [], spaces: [], hardware: [], diagnostics: [] };
  const add = (
    key: string,
    role: Panel['role'],
    label: string,
    materialId: string,
    b: Box,
    thicknessAxis: Panel['thicknessAxis'],
    grainAxis: Panel['grainAxis'],
    banded: Face[],
    shape?: Panel['shape'],
  ) =>
    local.panels.push({
      id: `${id}/${key}`,
      nodeId: role === 'door' ? s.id : id,
      role,
      label,
      materialId,
      box: b,
      thicknessAxis,
      grainAxis,
      banded,
      ...(shape ? { shape } : {}),
    });
  if (bt) {
    add('back-a', 'back', 'Back (back wall)', backM.id, box(0, ph, 0, W, H - ph, bt), 'z', 'x', []);
    add(
      'back-b',
      'back',
      'Back (side wall)',
      backM.id,
      box(0, ph, bt, bt, H - ph, W - bt),
      'x',
      'z',
      [],
    );
  }
  add(
    'side-r',
    'side',
    'Side return right',
    body.id,
    box(W - t, ph, bt, t, H - ph, D - bt),
    'x',
    'y',
    ['+z'],
  );
  add(
    'side-l',
    'side',
    'Side return left',
    body.id,
    box(bt, ph, W - t, D - bt, H - ph, t),
    'z',
    'y',
    ['+x'],
  );
  // Five-sided boards between the returns: the cut edge runs parallel to the doors, set in by the return thickness.
  const Wb = W - t - bt;
  const pent: [number, number][] = [
    [0, 0],
    [Wb, 0],
    [Wb, D - bt],
    [D - bt, Wb],
    [0, Wb],
  ];
  const board = (key: string, role: Panel['role'], label: string, y: number) =>
    add(key, role, label, body.id, box(bt, y, bt, Wb, t, Wb), 'y', 'x', ['+x', '+z'], {
      kind: 'profile',
      points: pent,
    });
  board('bottom', 'bottom', 'Bottom', ph);
  board('top', 'top', 'Top', H - t);
  // A doubled top (ADR-105): a second board under the first; the outer height stays.
  const tt = p.topLayers === 2 ? 2 * t : t;
  if (tt > t) board('top/1', 'top', 'Top', H - tt);
  const room = H - ph - t - tt - s.count * t;
  if (s.count < 0 || room < (s.count + 1) * 20)
    return err('shelves-crowded', `${s.count} shelves do not fit in ${H - ph - t - tt} mm.`);
  let y = ph + t;
  for (const [i, gap] of equalParts(room, s.count + 1)
    .slice(0, -1)
    .entries()) {
    y += gap;
    board(`shelf/${i}`, 'shelf', 'Shelf', y);
    y += t;
  }
  // Along the diagonal: unit vector u from the left return's front corner (D, W) to the right one's (W, D).
  const r2 = Math.SQRT1_2;
  const along = (k: number, off: number): [number, number] => [
    Math.round(D + k * r2 + off * r2),
    Math.round(W - k * r2 + off * r2),
  ];
  const span = Math.round(Math.SQRT2 * (W - D));
  // Plinth board set back from the doors; its ends stop short of the returns by the set-back.
  if (ph > 0) {
    const inset = p.plinthSetback + t,
      len = span - 2 * inset;
    const [px, pz] = along(inset, -inset - 1);
    add(
      'plinth',
      'plinth',
      'Plinth (diagonal)',
      body.id,
      box(px, 0, pz, len, ph, t),
      'z',
      'x',
      ['+z'],
      { kind: 'tilt', axis: 'y', angleDeg: 45, pivot: [0, 0, 0] },
    );
  }
  // Doors just outside the diagonal (1 mm clear, so whole-mm rounding never pushes them into the carcass).
  const doors = s.front;
  if (doors && doors.kind === 'doors') {
    const r = lo(g),
      n = doors.count,
      dh = H - ph - 2 * r;
    const leaf = Math.floor((span - 2 * r - (n - 1) * g) / n);
    if (leaf < 100 || dh < 100) return err('door-small', `Door ${leaf}×${dh} mm is too small.`);
    for (let i = 0; i < n; i++) {
      const [dx, dz] = along(r + i * (leaf + g), 1);
      add(
        `door/${i}`,
        'door',
        n > 1 ? `Door ${i ? 'right' : 'left'} (diagonal)` : 'Door (diagonal)',
        front.id,
        box(dx, ph + r, dz, leaf, dh, tf),
        'z',
        'y',
        ['-x', '+x', '-y', '+y'],
        { kind: 'tilt', axis: 'y', angleDeg: 45, pivot: [0, 0, 0] },
      );
    }
    local.hardware.push({
      nodeId: s.id,
      kind: 'hinge',
      label: 'Concealed hinge for a 45° diagonal corner door',
      quantity: n * hingeCount(dh),
      note: `${hingeCount(dh)} per door (typical for ${hingeBand(dh)}); choose the hinge maker's 45° corner hinge or angled plate`,
    });
  } else if (doors) return err('diagonal-front', 'A diagonal corner takes one door or a pair.');
  if (s.count)
    local.hardware.push({
      nodeId: s.id,
      kind: 'shelf-pin',
      label: 'Shelf support',
      quantity: 4 * s.count,
      note: 'fixed shelves: 4 per shelf',
    });
  local.spaces.push({
    nodeId: s.id,
    kind: 'shelves',
    box: box(bt, ph + t, bt, Wb, H - ph - t - tt, Wb),
    depth: 0,
    leaf: true,
    hasDoors: !!doors,
  });
  merge(out, p.side === 'left' ? local : mirrorDiagonal(local, W));
  return out;
}

/**
 * Mirror for a corner on the right: x → W − x (the blanks move with `mirror`). A turn about the vertical turns the
 * other way, about the mirrored pivot (w − x from the new min corner); profiles whose first axis is x flip across it.
 */
function mirrorDiagonal(m: PartialModel, W: number): PartialModel {
  const mm = mirror(m, W);
  mm.panels = mm.panels.map((p) => {
    const s = p.shape;
    if (!s) return p;
    if (s.kind === 'profile')
      return p.thicknessAxis === 'x'
        ? p
        : {
            ...p,
            shape: {
              kind: 'profile',
              points: s.points.map(([u, v]) => [p.box.w - u, v] as [number, number]).reverse(),
            },
          };
    return {
      ...p,
      shape: {
        ...s,
        angleDeg: s.axis === 'x' ? s.angleDeg : -s.angleDeg,
        pivot: [p.box.w - s.pivot[0], s.pivot[1], s.pivot[2]],
      },
    };
  });
  return mm;
}

export function buildCorner(
  p: CornerParams,
  id: string,
  materials: Map<string, Material>,
): PartialModel {
  const out: PartialModel = { panels: [], spaces: [], hardware: [], diagnostics: [] };
  const err = (code: string, message: string) =>
    out.diagnostics.push({ severity: 'error', code, message, nodeId: id });
  const warn = (code: string, message: string) =>
    out.diagnostics.push({ severity: 'warning', code, message, nodeId: id });
  const body = materials.get(p.bodyMaterialId),
    front = materials.get(p.frontMaterialId);
  if (!body || !front) {
    err('material-missing', 'A material used by this corner cabinet does not exist in the design.');
    return out;
  }
  if (p.variant === 'diagonal') return buildDiagonal(p, id, materials, out);
  const t = body.thickness,
    tf = front.thickness,
    g = p.frontGap,
    D = p.depth;
  const r = lo(g);

  if (p.variant === 'blind') {
    const usable = p.width - p.blindWidth;
    if (p.blindWidth < 3 * t || usable < 3 * t) {
      err(
        'corner-size',
        `Blind section ${p.blindWidth} mm and usable section ${usable} mm must each be at least ${3 * t} mm.`,
      );
      return out;
    }
    if (p.blindWidth < D + 50)
      warn(
        'blind-clearance',
        `Blind section is ${p.blindWidth} mm; about the neighbouring cabinet's depth + 50 mm (${D + 50} mm) keeps its door and handle clear of this door.`,
      );
    // Drawn with the blind section on the left, mirrored for the right.
    const blind = buildCabinet(
      carcass(p, p.blindWidth, { id: `${id}:blind`, kind: 'empty' }),
      materials,
      { idPrefix: `${id}/blind:`, productNodeId: id, mapNodeId: () => id },
    );
    const main = buildCabinet(carcass(p, usable, p.interior), materials, {
      idPrefix: `${id}/main:`,
      productNodeId: id,
      origin: { x: p.blindWidth, y: 0, z: 0 },
    });
    const local: PartialModel = { panels: [], spaces: [], hardware: [], diagnostics: [] };
    merge(local, blind);
    merge(local, main);
    // Fixed blind panel in front of the blind section, one gap from the usable section's door.
    const ph = p.plinthHeight;
    local.panels.push({
      id: `${id}/blind-panel`,
      nodeId: id,
      role: 'blind-panel',
      label: 'Blind panel',
      materialId: front.id,
      box: box(r, ph + r, D, p.blindWidth - r - (g - r), p.height - ph - 2 * r, tf),
      thicknessAxis: 'z',
      grainAxis: 'y',
      banded: ['-x', '+x', '-y', '+y'],
    });
    merge(out, p.side === 'left' ? local : mirror(local, p.width));
    return out;
  }

  // L-shape, corner on the left: wing A along the back wall, wing B along the left wall.
  const wb = p.wingWidth - D;
  if (p.width < D + 3 * t + 100 || wb < 3 * t + 100) {
    err('corner-size', `Each wing must reach at least ${3 * t + 100} mm past the corner.`);
    return out;
  }
  const doorStart = D + tf + g; // A's door begins clear of B's door leaf
  const a = buildCabinet(carcass(p, p.width, p.interior), materials, {
    idPrefix: `${id}/a:`,
    productNodeId: id,
    frontTrim: { left: doorStart - r },
  });
  const bLocal = buildCabinet(carcass(p, wb, p.wingInterior), materials, {
    idPrefix: `${id}/b:`,
    productNodeId: id,
    omitSide: 'right',
  });
  // Wing B's plinth runs on past the corner edge until it butts against the front face of wing A's plinth (no notch).
  if (p.plinthHeight > 0)
    for (const x of bLocal.panels)
      if (x.role === 'plinth') x.box = { ...x.box, w: x.box.w + p.plinthSetback };
  const b: PartialModel = {
    panels: bLocal.panels.map((x) => rotatePanel(x, p.wingWidth)),
    spaces: bLocal.spaces.map((s): SpaceOpening => ({
      ...s,
      box: rotateBox(s.box, p.wingWidth),
      view: 'side',
    })),
    hardware: bLocal.hardware,
    diagnostics: bLocal.diagnostics,
  };
  const local: PartialModel = { panels: [], spaces: [], hardware: [], diagnostics: [] };
  merge(local, a);
  merge(local, b);
  const doorsA = a.panels.some((x) => x.role === 'door'),
    doorsB = bLocal.panels.some((x) => x.role === 'door');
  if (doorsA && doorsB) {
    local.hardware.push({
      nodeId: id,
      kind: 'corner-hinge',
      label: 'Corner fold hinge set (joins the two door leaves)',
      quantity: 1,
      note: 'confirm the set, and which carcass hinges it replaces, with the hinge datasheet',
    });
  }
  merge(out, p.side === 'left' ? local : mirror(local, p.width));
  return out;
}

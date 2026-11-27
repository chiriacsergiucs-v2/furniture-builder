/** The whole room built as one model: materials, parts, hardware, clearances and checks (G-548 split, ADR-306). */
import { planRuns, requestName, worktopJointChecks, worktopJointCuts } from './projectWorktops';
import { trimProfileChecks, worktopEdgeChecks } from './projectProfiles';
import { compatChecks } from './compat';
import { reachesArc, type Clearance } from './clearance';
import { BODY_CODES, envelopeChecks, worse, type ClearanceZone } from './envelopes';
import { boxInside, outlineIssues, outletDistanceChecks, roomChecks, serviceChecks } from './room';
import { setRooms } from './setRoom';
import { variableDiagnostics } from './variables';
import { bandFor, bandText } from './materials';
import { sheetOf } from './design';
import { cutDimensions, intersection, overlaps, penetration, union, yawPoint } from './geometry';
import { commonBuilds, commonPanels } from './common';
import { connectionDiagnostics } from './connections';
import { bounds2 } from './outline';
import { sharedBuilds } from './shared';
import { aabbOf, overlapsBox, panelsOverlap } from './shape';
import { modelBox, modelChecks, type ModelItem } from './model3d';
import type { Box, Diagnostic, FurnitureModel, HardwareItem, Material, Mm, Panel } from './types';
import { t, tr } from '@furniture-builder/i18n';
import { type PlacedPiece, placeItem } from './projectPlace';
import { type Project, requestKey } from './projectDoc';
import {
  applyRunHandles,
  plinthCovered,
  cutoutOutlines,
  followUpPanel,
  runPanel,
  cutoutChecks,
} from './projectRuns';
import { resolvePlacements, placementIssues, PIECE_WARNINGS } from './projectMove';

// ---------------------------------------------------------------------------
// The whole room
// ---------------------------------------------------------------------------

/** Materials of all pieces merged by name + thickness + grain (grained and plain boards never share a sheet). */
/** Boards with the same name, thickness and grain are one board; a picture (ADR-048) makes a different decor. */
export const materialKey = (m: Pick<Material, 'name' | 'thickness' | 'grain' | 'image'>) =>
  `mat:${m.name}|${m.thickness}|${m.grain ? 'grain' : 'plain'}${m.image ? `|img:${m.image.id}` : ''}`;

export interface ProjectModel {
  pieces: PlacedPiece[];
  /** All panels in room coordinates, material ids replaced by merged material keys. */
  model: FurnitureModel;
  /** The same panels grouped by piece, in item order (the exploded view spreads each piece on its own). */
  piecePanels: Panel[][];
  materials: Material[];
  diagnostics: Diagnostic[];
  /** Clearances that hit something (ADR-057), for the plan outline of the selected piece. */
  blocked: { itemId: string; box: Box }[];
  /** Display-only 3D models with the box each takes in the room (ADR-076). */
  models: { item: ModelItem; box: Box }[];
  /** Everything drawn: the panels and the model boxes (`model.bounds` stays the panels only, for parts and prints). */
  extent: Box;
  /** Every body, opening, chair and service zone with its worst problem, for the plan's Clearances overlay (ADR-073). */
  zones: ClearanceZone[];
}

/**
 * ADR-077: a run part is cut from a board of the pieces; it takes the band named on that board now, since its
 * stored copy of the board may predate the band. Boards no piece uses keep the copy's band.
 */
export function runMaterial(project: Project, m: Material): Material {
  const k = materialKey(m);
  for (const it of project.items)
    for (const pm of it.design.materials)
      if (materialKey(pm) === k) return { ...m, band: pm.band, frontBand: pm.frontBand };
  return m;
}

export function buildProjectModel(input: Project): ProjectModel {
  // Run handles reach the pieces' fronts when built (ADR-125).
  const project = applyRunHandles(resolvePlacements(input));
  const covered = plinthCovered(project);
  // Common tops and bottoms (ADR-165) and shared sides (ADR-190): how each member is built, and the links that no
  // longer fit.
  const common = commonBuilds(project);
  const shared = sharedBuilds(project);
  const pieces = project.items.map((i) =>
    placeItem(i, {
      noPlinth: covered.has(i.id),
      common: common.builds.get(i.id),
      shared: shared.builds.get(i.id),
      sharedPins: shared.pins.get(i.id),
      room: project.room,
    }),
  );
  const materials = new Map<string, Material>();
  const panels: Panel[] = [];
  const piecePanels: Panel[][] = [];
  const hardware: HardwareItem[] = [];
  // Variables and bindings with problems (ADR-166, ADR-008), checked apart from the generators; common tops and
  // bottoms that are not built (ADR-165); connections that no longer hold (ADR-168).
  const diagnostics: Diagnostic[] = [
    ...placementIssues(project),
    ...variableDiagnostics(project),
    ...common.diagnostics,
    ...shared.diagnostics,
    ...connectionDiagnostics(project, pieces),
  ];
  for (const pc of pieces) {
    const mats = new Map(pc.item.design.materials.map((m) => [m.id, m]));
    for (const m of pc.item.design.materials) {
      const k = materialKey(m),
        seen = materials.get(k);
      if (!seen) {
        materials.set(k, { ...m, id: k, sheet: sheetOf(m) });
        continue;
      }
      const a = seen.sheet!,
        b = sheetOf(m);
      if (
        a.length !== b.length ||
        a.width !== b.width ||
        a.trim !== b.trim ||
        a.count !== b.count
      ) {
        diagnostics.push({
          severity: 'warning',
          code: 'material-sheet-conflict',
          message: t(
            "{board} has different sheet settings in {name}; the first piece's sheet ({l} × {w}) is used for the whole project.",
            { board: tr(m.name), name: tr(pc.item.design.name), l: a.length, w: a.width },
          ),
          nodeId: pc.item.id,
        });
      }
    }
    const own = pc.panels.map((p) => {
      const m = mats.get(p.materialId);
      return { ...p, materialId: m ? materialKey(m) : p.materialId };
    });
    piecePanels.push(own);
    panels.push(...own);
    for (const h of pc.model.hardware)
      hardware.push({
        ...h,
        nodeId: `${pc.item.id}:${h.nodeId}`,
        quantity: h.quantity * pc.item.quantity,
      });
    // A piece's own warnings reach the project's checks and prints (ADR-258), named by the piece; its errors are
    // summarised below. Panel ids follow the project's `item:panel` form.
    for (const d of pc.model.diagnostics)
      if (d.severity === 'warning') {
        const carried: Diagnostic = {
          ...d,
          message: t('{name}: {message}', { name: tr(pc.item.design.name), message: d.message }),
          nodeId: pc.item.id,
          itemIds: [pc.item.id],
          ...(d.panelIds ? { panelIds: d.panelIds.map((id) => `${pc.item.id}:${id}`) } : {}),
        };
        PIECE_WARNINGS.add(carried);
        diagnostics.push(carried);
      }
    const errs = pc.model.diagnostics.filter((d) => d.severity === 'error').length;
    if (errs)
      diagnostics.push({
        severity: 'error',
        code: 'piece-errors',
        message: t('{name} has {n|# problem|# problems}; open it to fix.', {
          name: tr(pc.item.design.name),
          n: errs,
        }),
        nodeId: pc.item.id,
      });
  }
  // One panel per common top or bottom, on the leftmost member's board (ADR-165).
  const byItem = new Map(pieces.map((pc) => [pc.item.id, pc]));
  for (const cp of commonPanels(
    project,
    common.plans,
    new Map(pieces.filter((pc) => pc.removed).map((pc) => [pc.item.id, pc.removed!])),
    (itemId, materialId) => {
      const m = byItem.get(itemId)?.item.design.materials.find((x) => x.id === materialId);
      return m ? materialKey(m) : materialId;
    },
  )) {
    panels.push(cp);
    piecePanels.push([cp]);
  }
  // Pieces may touch but not occupy the same space (bounding boxes first, then panels).
  const overlapping = new Set<string>();
  for (let a = 0; a < pieces.length; a++)
    for (let b = a + 1; b < pieces.length; b++) {
      if (!overlaps(pieces[a].bounds, pieces[b].bounds)) continue;
      const hit = pieces[a].panels.find((p) => pieces[b].panels.some((q) => panelsOverlap(p, q)));
      if (hit) overlapping.add(pieces[a].item.id).add(pieces[b].item.id);
      if (hit) {
        // Where and how much (ADR-071): the shared part of their outlines, and its thinnest side (the shortest way out).
        // Pieces at an angle are measured on their turned outlines (ADR-205: separating-axis penetration, rounded up).
        const box = intersection(pieces[a].bounds, pieces[b].bounds);
        const amount =
          pieces[a].outline.yaw || pieces[b].outline.yaw
            ? Math.max(1, penetration(pieces[a].outline, pieces[b].outline))
            : Math.min(box.w, box.h, box.d);
        diagnostics.push({
          severity: 'error',
          code: 'pieces-overlap',
          message: t('{a} and {b} overlap by {amount} mm in the room.', {
            a: pieces[a].item.design.name,
            b: pieces[b].item.design.name,
            amount,
          }),
          nodeId: pieces[b].item.id,
          itemIds: [pieces[a].item.id, pieces[b].item.id],
          box,
          amount,
        });
      }
    }
  // Compatibility rules over pieces that touch side by side (ADR-100): warnings, never blocking.
  diagnostics.push(...compatChecks(pieces, project.runParts ?? []));
  for (const pc of pieces)
    if (pc.bounds.y < 0)
      diagnostics.push({
        severity: 'error',
        code: 'below-floor',
        message: t('{name} goes below the floor.', { name: pc.item.design.name }),
        nodeId: pc.item.id,
      });
  // Run parts (ADR-036): their own panels, checked against every piece like pieces are against each other.
  const placedById = new Map(pieces.map((pc) => [pc.item.id, pc]));
  // Worktops meeting at a corner, with the joint the user chose (ADR-205).
  const joints = worktopJointCuts(project);
  // The sink and hob cut-outs, cut through their worktops in 3D (ADR-209).
  const cutouts = cutoutOutlines(project, pieces);
  for (const rp of project.runParts ?? []) {
    // Made for pieces that are gone, or a run plinth no longer as long as its pieces (refresh off, ADR-061).
    const src = (rp.from ?? []).map((id) => placedById.get(id));
    const stale =
      src.some((pc) => !pc) ||
      (rp.kind === 'plinth' &&
        src.length > 0 &&
        (Math.min(...src.map((pc) => pc!.bounds.x)) !== rp.box.x ||
          Math.max(...src.map((pc) => pc!.bounds.x + pc!.bounds.w)) !== rp.box.x + rp.box.w));
    if (stale)
      diagnostics.push({
        severity: 'error',
        code: 'run-part-stale',
        message: t(
          '{part} was made for pieces that changed or were removed; suggest the run parts again.',
          { part: rp.label },
        ),
        nodeId: `run:${rp.id}`,
      });
    const k = materialKey(rp.material);
    if (!materials.has(k)) materials.set(k, { ...rp.material, id: k, sheet: sheetOf(rp.material) });
    // A worktop's cut-outs as holes, a moulding's profile and a worktop's edge, for 3D (ADR-209).
    const panel = followUpPanel(
      project,
      rp,
      runPanel(rp, k, joints.get(rp.id)),
      cutouts.filter((c) => c.partId === rp.id),
    );
    // ADR-077: a band narrower than the run part's board is an error, as on a piece's own parts.
    const band = panel.banded.length
      ? bandFor(runMaterial(project, rp.material), panel.role)
      : undefined;
    const th = cutDimensions(panel, rp.material.grain).thickness;
    if (band && band.width < th)
      diagnostics.push({
        severity: 'error',
        code: 'band-narrow',
        message: t('Edge band {band} on {board} ({part}) is narrower than the {t} mm board.', {
          band: bandText(band),
          board: tr(rp.material.name),
          part: rp.label,
          t: th,
        }),
        nodeId: `run:${rp.id}`,
      });
    panels.push(panel);
    piecePanels.push([panel]);
    const hit = pieces.find(
      (pc) => overlaps(pc.bounds, panel.box) && pc.panels.some((q) => overlapsBox(q, panel.box)),
    );
    if (hit)
      diagnostics.push({
        severity: 'error',
        code: 'run-part-overlap',
        message: t('{part} overlaps {name}; suggest the run parts again after moving pieces.', {
          part: rp.label,
          name: hit.item.design.name,
        }),
        nodeId: `run:${rp.id}`,
      });
  }
  diagnostics.push(
    ...cutoutChecks(project, placedById, 'sink'),
    ...cutoutChecks(project, placedById, 'hob'),
    ...(project.room?.outletDistances
      ? outletDistanceChecks(project.room, cutoutOutlines(project, pieces))
      : []),
    ...worktopJointChecks(project),
    ...trimProfileChecks(project),
    ...worktopEdgeChecks(project),
  );
  // Run parts the user asked for that could not be made (ADR-075): an error, never left out silently (ADR-008).
  const made = new Set((project.runParts ?? []).map((rp) => rp.key));
  const missing = (project.runRequests ?? []).filter((r) => !made.has(requestKey(r)));
  if (missing.length) {
    const { unmade } = planRuns(project);
    for (const r of missing) {
      diagnostics.push({
        severity: 'error',
        code: 'run-request',
        message:
          unmade[requestKey(r)] ??
          t('{part} is not made yet; suggest the run parts again.', {
            part: requestName(r, project),
          }),
        nodeId: `request:${requestKey(r)}`,
      });
    }
  }
  // Display-only 3D models (ADR-076): their boxes are checked like pieces, never cut.
  const models = (project.models ?? []).map((item) => ({ item, box: modelBox(item) }));
  const checked = pieces.map((pc) => ({
    id: pc.item.id,
    name: pc.item.design.name,
    bounds: pc.bounds,
    outline: pc.outline,
    hitsPanels: (b: Box) => pc.panels.some((q) => overlapsBox(q, b)),
    // A back cut around this pipe or outlet (ADR-205) no longer covers it.
    covers: (b: Box, featureId?: string) =>
      pc.panels.find(
        (q) =>
          COVER_ROLES.has(q.role) &&
          !(q.role === 'back' && !!featureId && !!pc.backCut?.includes(featureId)) &&
          overlapsBox(q, b),
      )?.role ?? null,
    clearances: pc.clearances,
  }));
  // Run parts (worktop, plinth, fillers, covers) are checked against models too.
  const runChecked = panels
    .filter((p) => p.id.startsWith('run:'))
    .map((p) => ({
      id: p.id,
      name: p.label,
      bounds: aabbOf(p),
      hitsPanels: (b: Box) => overlapsBox(p, b),
    }));
  diagnostics.push(...modelChecks(project.models ?? [], [...checked, ...runChecked]));
  const asPieces = models.map((m) => ({
    id: m.item.id,
    name: m.item.name,
    bounds: m.box,
    hitsPanels: (b: Box) => overlaps(m.box, b),
    clearances: [],
  }));
  // The room (ADR-058): walls, obstacles, door swings and windows; obstacles also block openings (ADR-057). A value
  // set's pieces are checked against the room at the set's origin (ADR-167).
  const setOf = new Map(project.items.map((i) => [i.id, i.set?.id ?? '']));
  const rooms = project.room
    ? [
        { id: '', room: project.room },
        ...setRooms(project).map((sr) => ({ id: sr.set.id, room: sr.room })),
      ]
    : [];
  const rcs = rooms.map(({ id, room }) =>
    roomChecks(room, [
      ...checked.filter((c) => (setOf.get(c.id) ?? '') === id),
      ...(id === '' ? asPieces : []),
    ]),
  );
  const rc = rcs.length
    ? {
        diagnostics: rcs.flatMap((r) => r.diagnostics),
        clearanceIssues: rcs.flatMap((r) => r.clearanceIssues),
        obstacles: rcs.flatMap((r) => r.obstacles),
      }
    : null;
  if (rc) diagnostics.push(...rc.diagnostics, ...rc.clearanceIssues);
  // Run worktops and plinths over a pipe or outlet (ADR-072).
  if (project.room && !outlineIssues(project.room.outline).length)
    for (const rp of project.runParts ?? [])
      if (COVER_ROLES.has(rp.kind))
        diagnostics.push(
          ...serviceChecks(project.room, {
            id: `run:${rp.id}`,
            name: rp.label,
            bounds: rp.box,
            covers: (b: Box) => (overlaps(rp.box, b) ? rp.kind : null),
          }),
        );
  const obstacles = [
    ...(rc?.obstacles ?? []),
    ...models.map((m) => ({ label: m.item.name, box: m.box })),
  ];
  // A shaped common top can be concave (an L, ADR-189); doors are checked against its convex pieces instead: the
  // members' own former tops and the gaps it bridges.
  const commonPieces: Panel[] = [
    ...pieces.flatMap((pc) => pc.removed ?? []),
    ...[...common.plans.entries()].flatMap(([id, plan]) =>
      plan.gaps.map((g, i) => {
        const top = panels.find((q) => q.id === `common:${id}`);
        const b = bounds2(g.rect);
        return {
          ...top!,
          id: `common:${id}/gap/${i}`,
          shape: undefined,
          box: { x: b.x, y: top!.box.y, z: b.z, w: b.w, h: top!.box.h, d: b.d },
        };
      }),
    ),
  ];
  const blocked = openingChecks(
    pieces,
    [...panels.filter((q) => !q.id.startsWith('common:')), ...commonPieces],
    diagnostics,
    obstacles,
  );
  const zones = clearanceZones(
    project,
    pieces,
    panels,
    diagnostics,
    blocked,
    overlapping,
    obstacles,
  );
  const model: FurnitureModel = {
    panels,
    spaces: [],
    hardware,
    diagnostics,
    bounds: union(panels.map(aabbOf)),
  };
  return {
    pieces,
    model,
    piecePanels,
    materials: [...materials.values()],
    diagnostics,
    blocked,
    models,
    extent: union([...panels.map(aabbOf), ...models.map((m) => m.box)]),
    zones,
  };
}

// ---------------------------------------------------------------------------
// Chair, installation and service clearances; the Clearances overlay (ADR-073)
// ---------------------------------------------------------------------------

/**
 * Check the chair, installation and service envelopes (adding their diagnostics), then list every zone for the
 * plan overlay with its worst problem: bodies (overlap, room, installation), door swings, drawer travel, flaps
 * (ADR-057 checks), chair and service zones.
 */
function clearanceZones(
  project: Project,
  pieces: PlacedPiece[],
  allPanels: Panel[],
  diagnostics: Diagnostic[],
  blocked: { itemId: string; box: Box }[],
  overlapping: Set<string>,
  obstacles: { label: string; box: Box }[],
): ClearanceZone[] {
  const byId = new Map(project.items.map((i) => [i.id, i]));
  const carried = (id: string) =>
    new Set(
      project.items
        .filter((i) => {
          for (let cur = i, n = 0; n <= project.items.length; n++) {
            if (cur.placement?.kind !== 'above') return false;
            if (cur.placement.baseId === id) return true;
            const next = byId.get(cur.placement.baseId);
            if (!next) return false;
            cur = next;
          }
          return false;
        })
        .map((i) => i.id),
    );
  const ec = envelopeChecks(
    pieces.map((pc) => ({
      id: pc.item.id,
      name: pc.item.design.name,
      bounds: pc.bounds,
      panels: pc.panels,
      envelopes: pc.envelopes,
      zones: pc.item.zones,
      carried: pc.envelopes.some((e) => e.kind === 'installation')
        ? carried(pc.item.id)
        : new Set<string>(),
    })),
    allPanels.filter((p) => p.id.startsWith('run:')),
    obstacles,
    project.room,
  );
  diagnostics.push(...ec.diagnostics);
  const blockedBoxes = new Set(blocked.map((b) => b.box));
  const room = project.room;
  const out: ClearanceZone[] = [];
  for (const pc of pieces) {
    const id = pc.item.id;
    let body: ClearanceZone['severity'] = overlapping.has(id) ? 'error' : 'none';
    for (const d of diagnostics)
      if (d.nodeId === id && BODY_CODES.has(d.code)) body = worse(body, d.severity);
    out.push({
      itemId: id,
      kind: 'body',
      label: pc.item.design.name,
      box: pc.outline,
      severity: body,
    });
    for (const c of pc.clearances) {
      const panel = pc.panels.find((p) => p.id === c.panelId);
      const bad =
        blockedBoxes.has(c.box) ||
        (!!room && !boxInside(room.outline, c.box)) ||
        pieces.some((o) => o !== pc && o.clearances.some((y) => overlaps(c.box, y.box)));
      out.push({
        itemId: id,
        kind:
          panel?.front === 'flap-up' || panel?.front === 'flap-down'
            ? 'flap'
            : panel?.role === 'door'
              ? 'door'
              : 'drawer',
        label: c.label,
        box: c.box,
        severity: bad ? 'warning' : 'none',
      });
    }
    for (const e of pc.envelopes)
      out.push({
        itemId: id,
        kind: e.kind,
        label: e.label,
        box: e.box,
        severity: ec.severity.get(e) ?? 'none',
        // ADR-205: where it lies before it is tipped up, and the arc its top sweeps, for the plan.
        ...(e.kind === 'installation' ? { tipUp: tipUpOf(pc) } : {}),
      });
  }
  return out;
}

/**
 * Where a piece lies on its back before it is tipped up (ADR-205): the floor strip in front of it, as deep as it is
 * high, and a quarter arc of that radius from its front corner, as a door swing is drawn; turned with the piece.
 */
function tipUpOf(pc: PlacedPiece): NonNullable<ClearanceZone['tipUp']> {
  const o = pc.outline,
    r = o.h;
  const { axis, sign } = pc.facing;
  const strip: Box =
    axis === 'z'
      ? { x: o.x, y: 0, z: sign > 0 ? o.z + o.d : o.z - r, w: o.w, h: 0, d: r }
      : { x: sign > 0 ? o.x + o.w : o.x - r, y: 0, z: o.z, w: r, h: 0, d: o.d };
  // The hinge: the front edge's corner on the piece's left as seen from the front (a door swing's start).
  const hinge: [number, number] =
    axis === 'z'
      ? sign > 0
        ? [o.x, o.z + o.d]
        : [o.x + o.w, o.z]
      : sign > 0
        ? [o.x + o.w, o.z + o.d]
        : [o.x, o.z];
  const n: [number, number] = axis === 'z' ? [0, sign] : [sign, 0];
  const along: [number, number] = axis === 'z' ? [sign, 0] : [0, -sign];
  const turn = (p: [number, number]): [number, number] => (o.yaw ? yawPoint(o.yaw, p[0], p[1]) : p);
  const from = turn([hinge[0] + n[0] * r, hinge[1] + n[1] * r]);
  const to = turn([hinge[0] + along[0] * r, hinge[1] + along[1] * r]);
  const h = turn(hinge);
  const cross = (from[0] - h[0]) * (to[1] - h[1]) - (from[1] - h[1]) * (to[0] - h[0]);
  return {
    strip: o.yaw ? { ...strip, yaw: o.yaw } : strip,
    hinge: h,
    from,
    to,
    radius: r,
    sweep: cross > 0 ? 1 : 0,
  };
}

/** Parts that cover a pipe or outlet behind them (ADR-072). */
const COVER_ROLES: ReadonlySet<string> = new Set(['back', 'plinth', 'worktop']);

// ---------------------------------------------------------------------------
// Opening clearance (ADR-057)
// ---------------------------------------------------------------------------

/** Free room in front of a clearance's front before `hit` (mm), along the piece's facing. */
function freeBefore(c: Clearance, f: PlacedPiece['facing'], hit: Box): Mm {
  const k = f.axis,
    w = k === 'x' ? 'w' : 'd';
  return Math.max(0, f.sign > 0 ? hit[k] - c.box[k] : c.box[k] + c.box[w] - (hit[k] + hit[w]));
}

/**
 * Warn when the space a front needs to open is taken by another piece, a run part or a wall feature (`obstacles`),
 * and when two pieces' openings swing into the same space. Warnings only: export stays allowed (ADR-008, ADR-010).
 */
function openingChecks(
  pieces: PlacedPiece[],
  allPanels: Panel[],
  diagnostics: Diagnostic[],
  obstacles: { label: string; box: Box }[] = [],
): { itemId: string; box: Box }[] {
  const blocked: { itemId: string; box: Box }[] = [];
  for (const pc of pieces) {
    const own = `${pc.item.id}:`;
    for (const c of pc.clearances) {
      const hits = [
        ...allPanels
          // A door's swing (G-011): only what reaches into the quarter circle about its hinge.
          .filter((q) => !q.id.startsWith(own) && overlapsBox(q, c.box) && reachesArc(c, aabbOf(q)))
          .map((q) => ({
            box: aabbOf(q),
            exact: q.shape ? aabbOf(q) : q.box,
            itemId: q.id.startsWith('run:')
              ? undefined
              : pieces.find((o) => q.id.startsWith(`${o.item.id}:`))?.item.id,
            name: q.id.startsWith('run:')
              ? q.label
              : (pieces.find((o) => q.id.startsWith(`${o.item.id}:`))?.item.design.name ?? q.label),
          })),
        ...obstacles
          .filter((o) => overlaps(o.box, c.box) && reachesArc(c, o.box))
          .map((o) => ({ box: o.box, exact: o.box, itemId: undefined, name: o.label })),
      ];
      if (!hits.length) continue;
      const near = hits.reduce((a, b) =>
        freeBefore(c, pc.facing, b.box) < freeBefore(c, pc.facing, a.box) ? b : a,
      );
      blocked.push({ itemId: pc.item.id, box: c.box });
      // At an angle (ADR-205) the space missing is how far the two turned boxes go into each other.
      const turned = !!c.box.yaw || !!near.exact.yaw;
      const free = turned
        ? Math.max(0, c.need - Math.max(1, penetration(c.box, near.exact)))
        : freeBefore(c, pc.facing, near.box);
      diagnostics.push({
        severity: 'warning',
        code: 'opening-blocked',
        message: t(
          '{front} of {name} cannot open fully: it hits {other} (needs {need} mm, {free} mm free).',
          { front: c.label, name: pc.item.design.name, other: near.name, need: c.need, free },
        ),
        nodeId: pc.item.id,
        // ADR-071: the front, the piece in the way (when it is one), the blocked zone and the space missing.
        panelIds: [c.panelId],
        itemIds: near.itemId ? [near.itemId, pc.item.id] : [pc.item.id],
        box: intersection(c.box, near.box),
        amount: c.need - free,
      });
    }
  }
  for (let a = 0; a < pieces.length; a++)
    for (let b = a + 1; b < pieces.length; b++) {
      const clash = pieces[a].clearances.find((x) =>
        pieces[b].clearances.some((y) => overlaps(x.box, y.box)),
      );
      if (!clash) continue;
      const other = pieces[b].clearances.find((y) => overlaps(clash.box, y.box))!;
      diagnostics.push({
        severity: 'warning',
        code: 'openings-clash',
        message: t('{front} of {a} and {other} of {b} open into the same space.', {
          front: clash.label,
          a: pieces[a].item.design.name,
          other: other.label,
          b: pieces[b].item.design.name,
        }),
        nodeId: pieces[b].item.id,
      });
    }
  return blocked;
}

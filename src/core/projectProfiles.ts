/**
 * Moulding profiles and repair fillers of a run (ADR-209): moved out of project.ts unchanged (cleanup audit 2026-11-09, item 13).
 */
import {} from './build';
import {} from './compat';
import { bandKey, cutlist, hardwareSummary, type CutRow } from './cutlist';
import { DEFAULT_KERF, sheetOf } from './design';
import { commonBuilds } from './common';
import {} from './outline';
import { sharedBuilds } from './shared';
import { area2 } from './shape';
import {} from './planPicture';
import type { SheetSettings } from './nesting';
import { jobsFromCutlist } from './nesting';
import type { NestJob } from './nesting/types';
import type { Box, Diagnostic, Face, FurnitureModel, HardwareItem, Material, Mm } from './types';
import { t } from './i18n';

import {
  applyRunHandles,
  buildProjectModel,
  type CutoutOutline,
  cutoutOutlines,
  materialKey,
  type PlacedPiece,
  placeItem,
  planRuns,
  plinthCovered,
  type Project,
  type ProjectModel,
  requestKey,
  requestName,
  resolvePlacements,
  runMaterial,
  runPanel,
  type RunPart,
  runPartKey,
  runPartNames,
  type RunRequest,
  type RunSink,
  TRIM_KINDS,
  type TrimKind,
  worktopJointCuts,
} from './project';

// ---------------------------------------------------------------------------
// Moulding profiles and repair fillers (ADR-209)
// ---------------------------------------------------------------------------

/** The bounding box of a profile's points: its lowest corner and its width (across) and height (up). */
export function profileBounds(points: readonly [Mm, Mm][]): { u: Mm; v: Mm; w: Mm; h: Mm } {
  if (!points.length) return { u: 0, v: 0, w: 0, h: 0 };
  const us = points.map((p) => p[0]),
    vs = points.map((p) => p[1]);
  const u = Math.min(...us),
    v = Math.min(...vs);
  return { u, v, w: Math.max(...us) - u, h: Math.max(...vs) - v };
}

const orient = (a: [Mm, Mm], b: [Mm, Mm], c: [Mm, Mm]) =>
  Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
const onSegment = (a: [Mm, Mm], b: [Mm, Mm], c: [Mm, Mm]) =>
  Math.min(a[0], b[0]) <= c[0] &&
  c[0] <= Math.max(a[0], b[0]) &&
  Math.min(a[1], b[1]) <= c[1] &&
  c[1] <= Math.max(a[1], b[1]);
/** Whether segments ab and cd share a point (exact in integers). */
function segmentsMeet(a: [Mm, Mm], b: [Mm, Mm], c: [Mm, Mm], d: [Mm, Mm]): boolean {
  const o1 = orient(a, b, c),
    o2 = orient(a, b, d),
    o3 = orient(c, d, a),
    o4 = orient(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  return (
    (o1 === 0 && onSegment(a, b, c)) ||
    (o2 === 0 && onSegment(a, b, d)) ||
    (o3 === 0 && onSegment(c, d, a)) ||
    (o4 === 0 && onSegment(c, d, b))
  );
}

/**
 * Whether a moulding profile can be made (ADR-209): three points or more, none repeated, no two edges crossing or
 * doubling back, and an area. Otherwise it is the error `trim-profile-invalid`.
 */
export function profileValid(points: readonly [Mm, Mm][]): boolean {
  const n = points.length;
  if (n < 3) return false;
  if (new Set(points.map(([u, v]) => `${u},${v}`)).size !== n) return false;
  if (area2(points as [number, number][]) === 0) return false;
  for (let i = 0; i < n; i++) {
    const a = points[i],
      b = points[(i + 1) % n],
      c = points[(i + 2) % n];
    // Two edges in a row going back along each other.
    if (orient(a, b, c) === 0 && (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0)
      return false;
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsMeet(a, b, points[j], points[(j + 1) % n])) return false;
    }
  }
  return true;
}

/** "0,0; 20,0; 20,45; 0,60" → points; null when it is not whole-mm pairs (the field says so; nothing is saved). */
export function parseProfile(text: string): [Mm, Mm][] | null {
  const parts = text
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  const out: [Mm, Mm][] = [];
  for (const p of parts) {
    const m = /^(-?\d+)\s*,\s*(-?\d+)$/.exec(p);
    if (!m) return null;
    const u = Number(m[1]),
      v = Number(m[2]);
    if (Math.abs(u) > 1000 || Math.abs(v) > 1000) return null;
    out.push([u, v]);
  }
  return out;
}
export const profileText = (points: readonly [Mm, Mm][]) =>
  points.map(([u, v]) => `${u},${v}`).join('; ');

/** A crown or pelmet's profile as drawn in 3D (ADR-209): moved to start at 0, 0; null when absent or invalid. */
export function trimSection(r: RunRequest | undefined): [Mm, Mm][] | null {
  if (!r?.profile || (r.kind !== 'crown' && r.kind !== 'pelmet') || !profileValid(r.profile))
    return null;
  const b = profileBounds(r.profile);
  return r.profile.map(([u, v]) => [u - b.u, v - b.v]);
}

/** `trim-profile-invalid` (ADR-209): a crown or pelmet profile that crosses itself or has fewer than three points. */
export function trimProfileChecks(project: Project): Diagnostic[] {
  return (project.runRequests ?? [])
    .filter((r) => r.profile && (r.kind === 'crown' || r.kind === 'pelmet'))
    .filter((r) => !profileValid(r.profile!))
    .map((r) => ({
      severity: 'error' as const,
      code: 'trim-profile-invalid',
      message: t('The profile of {name} crosses itself or has fewer than three points.', {
        name: requestName(r, project),
      }),
      nodeId: `request:${requestKey(r)}`,
    }));
}

/** The board of a piece's fronts: a repair filler is made of it (ADR-054 fillers, ADR-209). */
function frontBoardOf(pc: PlacedPiece): Material | undefined {
  const p = pc.item.design.product;
  const id = p.kind === 'cabinet' || p.kind === 'corner' ? p.params.frontMaterialId : '';
  return pc.item.design.materials.find((m) => m.id === id) ?? pc.item.design.materials[0];
}

/**
 * A repair filler (ADR-209): `width` mm beside the door's piece (`from[0]`), on the side towards its neighbour
 * (`from[1]`), in the piece's front plane, as high as it, of its front board. Planned like every run part, so it follows
 * the pieces. Returns why it cannot be made instead.
 */
export function planRepairFiller(r: RunRequest, byId: Map<string, PlacedPiece>): RunPart | string {
  const pc = byId.get(r.from[0]),
    other = byId.get(r.from[1]);
  if (!pc || !other || r.from.length !== 2)
    return t('a piece it was made for is no longer in the project');
  const m = frontBoardOf(pc);
  if (!m) return t('choose its board');
  const w = r.width ?? 0;
  if (w < 1) return t('enter its width');
  const b = pc.bounds;
  const along = pc.facing.axis === 'z' ? 'x' : 'z';
  const th = m.thickness;
  const lo = along === 'x' ? b.x : b.z,
    hi = along === 'x' ? b.x + b.w : b.z + b.d;
  const oc =
    along === 'x' ? other.bounds.x + other.bounds.w / 2 : other.bounds.z + other.bounds.d / 2;
  const gap0 = oc < (lo + hi) / 2 ? lo - w : hi;
  const front =
    pc.facing.axis === 'z'
      ? pc.facing.sign > 0
        ? b.z + b.d - th
        : b.z
      : pc.facing.sign > 0
        ? b.x + b.w - th
        : b.x;
  const box: Box =
    along === 'x'
      ? { x: gap0, y: b.y, z: front, w, h: b.h, d: th }
      : { x: front, y: b.y, z: gap0, w: th, h: b.h, d: w };
  const key = requestKey(r);
  return {
    id: key,
    key,
    from: [...r.from],
    kind: 'filler',
    label: 'Filler',
    reason: `${w} mm gap so ${pc.item.design.name} opens clear of ${other.item.design.name} (repair)`,
    box,
    material: { ...m },
    thicknessAxis: along === 'x' ? 'z' : 'x',
    grainAxis: 'y',
    banded: along === 'x' ? ['-x', '+x', '-y', '+y'] : ['-z', '+z', '-y', '+y'],
  };
}

/**
 * Keep run parts in step with the pieces (ADR-061): with `runSettings.auto`, propose them again; parts with the
 * same key and box keep their stored copy, changed ones say what changed. Removed keys whose pieces are gone are
 * forgotten. Returns the same project when nothing changes.
 */
export function refreshRunParts(project: Project): Project {
  if (!project.runSettings?.auto) return project;
  const old = new Map((project.runParts ?? []).map((r) => [r.key ?? r.id, r]));
  const ids = new Set(project.items.map((i) => i.id));
  const removed = (project.runPartsRemoved ?? []).filter((k) =>
    k
      .split('|')[1]
      ?.split(',')
      .every((id) => ids.has(id)),
  );
  const next = planRuns({ ...project, runPartsRemoved: removed }).parts.map((r) => {
    const was = old.get(r.key!);
    if (!was) return r;
    // A trim's board is the one in its request (ADR-075); other parts keep their stored copy.
    const own = TRIM_KINDS.includes(r.kind as TrimKind);
    const same =
      JSON.stringify(was.box) === JSON.stringify(r.box) &&
      was.scribe === r.scribe &&
      (!own || JSON.stringify(was.material) === JSON.stringify(r.material));
    if (same) {
      const { changed: _c, ...keep } = was;
      void _c;
      return keep;
    }
    const along =
      (['w', 'h', 'd'] as const).find((k) => was.box[k] !== r.box[k]) ??
      (r.kind === 'cover' ? 'h' : 'w');
    return {
      ...r,
      material: own ? r.material : was.material,
      changed: `${was.box[along]} → ${r.box[along]} mm`,
    };
  });
  const before = JSON.stringify(project.runParts ?? []),
    after = JSON.stringify(next);
  if (before === after && removed.length === (project.runPartsRemoved ?? []).length) return project;
  return { ...project, runParts: next, runPartsRemoved: removed };
}

/**
 * The sink and hob cut-outs to make in a worktop (ADR-125, ADR-205): notes for its cut-list row, in the notes column
 * (printed in the print language, `drillingRo`).
 */
function cutoutNotes(project: Project, rp: RunPart, outlines: CutoutOutline[]): string[] {
  if (rp.kind !== 'worktop') return [];
  const on = (list: RunSink[] | undefined) =>
    (list ?? []).filter((sk) => rp.from?.includes(sk.baseId));
  // A placed cut-out (ADR-209) says where it is: from the base's left edge and the worktop's front edge.
  const at = (kind: 'sink' | 'hob', sk: RunSink) => {
    const o = outlines.find((x) => x.id === `${kind}:${sk.id}`);
    return o?.placed ? ` at ${o.x} mm from left and ${o.z} mm from front` : '';
  };
  return [
    ...on(project.sinks).map((sk) => `sink cut-out ${sk.w} × ${sk.d} mm${at('sink', sk)}`),
    ...on(project.hobs).map((hb) => `hob cut-out ${hb.w} × ${hb.d} mm${at('hob', hb)}`),
  ];
}

/**
 * Notes of ADR-209 on a run part's cut-list row: a moulding's profile and a worktop's rounded or bevelled front edge
 * (printed in the print language, `drillingRo`).
 */
function followUpNotes(project: Project, rp: RunPart): string[] {
  const out: string[] = [];
  if (rp.kind === 'crown' || rp.kind === 'pelmet') {
    const r = project.runRequests?.find((x) => requestKey(x) === rp.key);
    if (r?.profile && profileValid(r.profile)) {
      const b = profileBounds(r.profile);
      out.push(`profile ${b.w} × ${b.h} mm, drawn by you`);
    }
  }
  if (rp.kind === 'worktop') {
    const e = worktopEdgeOf(project, rp);
    if (e)
      out.push(e.kind === 'rounded' ? `rounded edge R${e.size} mm` : `bevelled edge ${e.size} mm`);
  }
  return out;
}

/** A worktop's rounded or bevelled front edge as made (ADR-209): null when square, not typed or too big (warned). */
export function worktopEdgeOf(
  project: Project,
  rp: RunPart,
): { kind: 'rounded' | 'bevel'; size: Mm } | null {
  const e = project.worktopEdges?.find((x) => x.key === runPartKey(rp));
  if (!e || e.kind === 'square' || e.size === undefined) return null;
  if (e.size >= rp.material.thickness) return null;
  return { kind: e.kind, size: e.size };
}

/** The front face of a worktop: the banded one (ADR-036, ADR-205). */
export const worktopFront = (rp: RunPart): Face => rp.banded.find((f) => f[1] !== 'y') ?? '+z';

/**
 * `worktop-edge-size` (ADR-209): a rounded or bevelled worktop edge without a size, or one not smaller than the
 * worktop's thickness, is drawn square until the user types one.
 */
export function worktopEdgeChecks(project: Project): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const e of project.worktopEdges ?? []) {
    if (e.kind === 'square') continue;
    const rp = (project.runParts ?? []).find(
      (x) => x.kind === 'worktop' && runPartKey(x) === e.key,
    );
    if (!rp) continue;
    const name = runPartNames(project, rp);
    const what = e.kind === 'rounded' ? t('rounded') : t('bevelled');
    if (e.size === undefined)
      out.push({
        severity: 'warning',
        code: 'worktop-edge-size',
        message: t(
          'The worktop over {name} has a {what} edge but no size; enter the edge size. It is drawn square until then.',
          { name, what },
        ),
        nodeId: `run:${rp.id}`,
      });
    else if (e.size >= rp.material.thickness)
      out.push({
        severity: 'warning',
        code: 'worktop-edge-size',
        message: t(
          'The {what} edge of the worktop over {name} is {size} mm, not less than the {t} mm worktop; it is drawn square.',
          { name, what, size: e.size, t: rp.material.thickness },
        ),
        nodeId: `run:${rp.id}`,
      });
  }
  return out;
}

/** Worktop edges follow their worktops (ADR-209): an edge whose worktop is gone goes. */
export function pruneWorktopEdges(project: Project): Project {
  if (!project.worktopEdges) return project;
  const live = new Set(
    (project.runParts ?? []).filter((rp) => rp.kind === 'worktop').map((rp) => runPartKey(rp)),
  );
  const kept = project.worktopEdges.filter((e) => live.has(e.key));
  if (kept.length === project.worktopEdges.length) return project;
  return { ...project, worktopEdges: kept.length ? kept : undefined };
}

/** Parts for the whole project: each piece's cut list × its quantity, merged across pieces, then the run parts. */
export function projectCutlist(input: Project, projectModel?: ProjectModel): CutRow[] {
  const project = applyRunHandles(input);
  const pieces = projectModel && piecesOf(project, projectModel);
  const rows = new Map<string, CutRow>();
  const extra = (project.runParts ?? []).map((rp) => ({ rp, key: materialKey(rp.material) }));
  // Worktops at a corner are cut to their joint (ADR-205).
  const joints = worktopJointCuts(project);
  if (extra.length) {
    // Where the sink and hob cut-outs are (ADR-209), for their notes.
    const outlines =
      project.sinks?.length || project.hobs?.length
        ? cutoutOutlines(
            project,
            resolvePlacements(project).items.map((i) => placeItem(i)),
          )
        : [];
    const mats = [
      ...new Map(
        extra.map((e) => [e.key, { ...runMaterial(project, e.rp.material), id: e.key }]),
      ).values(),
    ];
    // Fillers are cut wider by their scribe allowance (ADR-054); the model keeps the installed size.
    const cutPanel = (rp: RunPart, key: string) => {
      const p = runPanel(rp, key, joints.get(rp.id));
      return rp.scribe ? { ...p, box: { ...p.box, w: p.box.w + rp.scribe } } : p;
    };
    // One part at a time, so the sink and hob cut-outs and the corner joints (ADR-205) go in the row's notes column and
    // parts with different notes never share a row.
    for (const e of extra) {
      const model: FurnitureModel = {
        panels: [cutPanel(e.rp, e.key)],
        spaces: [],
        hardware: [],
        diagnostics: [],
        bounds: { x: 0, y: 0, z: 0, w: 0, h: 0, d: 0 },
      };
      for (const r of cutlist(model, mats)) {
        const drilling = [
          r.drilling,
          ...cutoutNotes(project, e.rp, outlines),
          ...(joints.get(e.rp.id)?.notes ?? []),
          ...followUpNotes(project, e.rp),
        ]
          .filter(Boolean)
          .join('; ');
        const key = [
          'run',
          r.materialId,
          r.length,
          r.width,
          r.edgesL,
          r.edgesW,
          bandKey(r.band),
          drilling,
        ].join('|');
        const labels = r.labels.map((l) => `Run: ${l}`);
        const cur = rows.get(key);
        if (cur) {
          cur.quantity += r.quantity;
          cur.panelIds.push(...r.panelIds);
          for (const l of labels) if (!cur.labels.includes(l)) cur.labels.push(l);
        } else rows.set(key, { ...r, drilling, labels });
      }
    }
  }
  const covered = plinthCovered(project);
  // Common tops and bottoms (ADR-165): members leave their own out, and each common panel is one row of its own.
  const common = commonBuilds(project);
  const shared = sharedBuilds(project);
  if (common.plans.size) {
    const pm = pieces && projectModel ? projectModel : buildProjectModel(input);
    const model: FurnitureModel = {
      panels: pm.model.panels.filter((p) => p.id.startsWith('common:')),
      spaces: [],
      hardware: [],
      diagnostics: [],
      bounds: { x: 0, y: 0, z: 0, w: 0, h: 0, d: 0 },
    };
    for (const r of cutlist(model, pm.materials))
      rows.set(
        ['common', r.materialId, r.length, r.width, r.edgesL, r.edgesW, bandKey(r.band)].join('|'),
        r,
      );
  }
  project.items.forEach((item, n) => {
    // The piece as the project model built it (ADR-221), or built the same way here.
    const model =
      pieces?.[n].model ??
      placeItem(item, {
        noPlinth: covered.has(item.id),
        common: common.builds.get(item.id),
        shared: shared.builds.get(item.id),
        sharedPins: shared.pins.get(item.id),
        room: project.room,
      }).model;
    for (const r of cutlist(model, item.design.materials)) {
      const mat = item.design.materials.find((m) => m.id === r.materialId)!;
      const id = materialKey(mat);
      const key = [
        id,
        r.length,
        r.width,
        r.edgesL,
        r.edgesW,
        r.drilling,
        bandKey(r.band),
        !!r.bandFront,
      ].join('|');
      const labels = r.labels.map((l) => `${item.design.name}: ${l}`);
      const panelIds = r.panelIds.map((p) => `${item.id}:${p}`);
      const cur = rows.get(key);
      if (cur) {
        cur.quantity += r.quantity * item.quantity;
        cur.panelIds.push(...panelIds);
        for (const l of labels) if (!cur.labels.includes(l)) cur.labels.push(l);
      } else
        rows.set(key, {
          ...r,
          materialId: id,
          quantity: r.quantity * item.quantity,
          labels,
          panelIds,
        });
    }
  });
  return [...rows.values()].sort(
    (a, b) =>
      a.materialName.localeCompare(b.materialName) ||
      b.thickness - a.thickness ||
      b.length - a.length ||
      b.width - a.width,
  );
}

/**
 * The project model's pieces when it was built from this project (ADR-221): one piece per item, in order. Undefined when
 * it was not, so the caller builds the pieces itself.
 */
function piecesOf(project: Project, pm: ProjectModel): PlacedPiece[] | undefined {
  return pm.pieces.length === project.items.length &&
    pm.pieces.every((pc, n) => pc.item.id === project.items[n].id)
    ? pm.pieces
    : undefined;
}

/**
 * The hardware of every piece × its quantity. Each piece counts the hardware of its own design, also inside a common
 * top or shared sides; with the project model, its items are used, so the pieces already placed are not built again
 * (ADR-221).
 */
export function projectHardware(input: Project, projectModel?: ProjectModel): HardwareItem[] {
  const project = applyRunHandles(input);
  const items =
    (projectModel && piecesOf(project, projectModel))?.map((pc) => pc.item) ?? project.items;
  return hardwareSummary({
    panels: [],
    spaces: [],
    diagnostics: [],
    bounds: { x: 0, y: 0, z: 0, w: 0, h: 0, d: 0 },
    hardware: items.flatMap((i) =>
      placeItem(i).model.hardware.map((h) => ({ ...h, quantity: h.quantity * i.quantity })),
    ),
  });
}

export function projectNestingJobs(
  project: Project,
  rows = projectCutlist(project),
  materials = buildProjectModel(project).materials,
): NestJob[] {
  const kerf = project.cutting?.kerf ?? DEFAULT_KERF;
  const settings = new Map<string, SheetSettings>();
  for (const m of materials) {
    const s = sheetOf(m);
    settings.set(m.id, {
      sheet: { length: s.length, width: s.width, count: s.count },
      trim: s.trim,
      kerf,
    });
  }
  return jobsFromCutlist(rows, settings);
}

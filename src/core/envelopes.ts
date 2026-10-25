/**
 * Chair, installation and service clearances (ADR-073): boxes derived in the core from a placed piece and the sizes
 * the user set on it, never stored. Each is checked against the other pieces, the run parts and the room; problems
 * are warnings, except a piece marked "assembled lying down" that cannot be tipped up under the ceiling (an error).
 * The chair depth and the service zone size come from the user (ADR-010): nothing here has a default.
 */
import { buildModel } from './build';
import { overlaps, union } from './geometry';
import { rectInside, type Room } from './room';
import { aabbOf, overlapsBox } from './shape';
import type { Box, Design, Diagnostic, FurnitureModel, Mm, Panel } from './types';

export type ServiceSide = 'front' | 'back' | 'left' | 'right';
export const SERVICE_SIDES: ServiceSide[] = ['front', 'back', 'left', 'right'];
/** Largest chair or service depth accepted, mm (a sanity bound for input, not a recommendation). */
export const MAX_ZONE_DEPTH: Mm = 10000;

/** Clearance sizes the user sets on a project item (ADR-073). Absent = none. */
export interface ItemZones {
  /** Desks: how deep the chair and user space in front of the knee space is, mm. No default. */
  chairDepth?: Mm;
  /** A zone kept free on one side of the piece (for example behind an appliance niche); no zone until `depth` is set. */
  service?: { side: ServiceSide; depth?: Mm };
  /** The piece is assembled lying on its back and tipped up in the room: no room to tip it up is an error. */
  lyingDown?: boolean;
}

export interface Envelope {
  kind: 'chair' | 'installation' | 'service';
  label: string;
  /** In the piece's own coordinates from `envelopesOf`, in room coordinates on a placed piece. */
  box: Box;
  /** Chair or service depth; for installation, the diagonal the piece sweeps when tipped up. */
  need: Mm;
}

/** Desk knee space along x (between the supports), in the desk's own coordinates; null for other pieces. */
export function kneeSpan(d: Design): { x0: Mm; x1: Mm } | null {
  if (d.product.kind !== 'desk') return null;
  const p = d.product.params;
  const t = d.materials.find((m) => m.id === p.bodyMaterialId)?.thickness ?? 0;
  const left = p.support === 'pedestal-left' || p.support === 'two-pedestals';
  const right = p.support === 'pedestal-right' || p.support === 'two-pedestals';
  const x0 = left ? p.pedestal.width : t,
    x1 = p.width - (right ? p.pedestal.width : t);
  return x1 > x0 ? { x0, x1 } : null;
}

/**
 * The envelopes of one piece in its own coordinates (front towards +z). `standsUp`: the piece is put up in the room
 * by tipping it from lying on its back (not wall-hung, not set on another piece), so it gets an installation zone:
 * above it, its side diagonal minus its height.
 */
export function envelopesOf(
  design: Design,
  zones: ItemZones | undefined,
  standsUp: boolean,
  model: FurnitureModel = buildModel(design),
): Envelope[] {
  if (!model.panels.length) return [];
  const b = union(model.panels.map(aabbOf));
  const out: Envelope[] = [];
  const knee = kneeSpan(design);
  const chair = zones?.chairDepth;
  if (knee && chair && chair > 0 && design.product.kind === 'desk') {
    const p = design.product.params;
    out.push({
      kind: 'chair',
      label: 'Chair space',
      need: chair,
      box: { x: knee.x0, y: 0, z: b.z + b.d, w: knee.x1 - knee.x0, h: p.height, d: chair },
    });
  }
  if (standsUp) {
    const diag = Math.ceil(Math.hypot(b.h, b.d));
    if (diag > b.h)
      out.push({
        kind: 'installation',
        label: 'Installation space',
        need: diag,
        box: { x: b.x, y: b.y + b.h, z: b.z, w: b.w, h: diag - b.h, d: b.d },
      });
  }
  const sv = zones?.service;
  if (sv?.depth && sv.depth > 0) {
    const s = sv.depth;
    const box: Box =
      sv.side === 'front'
        ? { ...b, z: b.z + b.d, d: s }
        : sv.side === 'back'
          ? { ...b, z: b.z - s, d: s }
          : sv.side === 'left'
            ? { ...b, x: b.x - s, w: s }
            : { ...b, x: b.x + b.w, w: s };
    out.push({ kind: 'service', label: `Service zone (${sv.side})`, need: s, box });
  }
  return out;
}

/** What a check needs from each placed piece. */
export interface EnvelopePiece {
  id: string;
  name: string;
  bounds: Box;
  panels: Panel[];
  envelopes: Envelope[];
  zones?: ItemZones;
  /** Ids of the pieces that rest on this one, directly or not (installed after it). */
  carried: Set<string>;
}

export type Severity = 'none' | 'warning' | 'error';

/**
 * Check every envelope: another piece's panels, a run part or a room obstacle inside it is a warning, as is a chair or
 * service zone through a wall. An installation zone above the room height is a warning, or an error when the piece is
 * marked "assembled lying down". Returns the diagnostics and the worst severity per envelope (same order as given).
 */
export function envelopeChecks(
  pieces: EnvelopePiece[],
  runPanels: Panel[],
  obstacles: { label: string; box: Box }[],
  room: Room | undefined,
): { diagnostics: Diagnostic[]; severity: Map<Envelope, Severity> } {
  const diagnostics: Diagnostic[] = [];
  const severity = new Map<Envelope, Severity>();
  for (const pc of pieces)
    for (const e of pc.envelopes) {
      let worst: Severity = 'none';
      const flag = (s: Exclude<Severity, 'none'>, code: string, message: string) => {
        diagnostics.push({ severity: s, code, message, nodeId: pc.id });
        if (s === 'error' || worst === 'none') worst = s;
      };
      const install = e.kind === 'installation';
      const hits = [
        ...pieces
          .filter(
            (o) =>
              o.id !== pc.id &&
              !(install && pc.carried.has(o.id)) &&
              overlaps(o.bounds, e.box) &&
              o.panels.some((q) => overlapsBox(q, e.box)),
          )
          .map((o) => o.name),
        // A worktop or filler is fitted after the pieces are stood up, so it does not block installing them.
        ...(install ? [] : runPanels.filter((q) => overlapsBox(q, e.box)).map((q) => q.label)),
        ...obstacles.filter((o) => overlaps(o.box, e.box)).map((o) => o.label),
      ];
      const what = install
        ? `${pc.name} needs ${e.need - pc.bounds.h} mm free above it to be tipped up from lying on its back (its diagonal is ${e.need} mm, its height ${pc.bounds.h} mm)`
        : `${e.label} of ${pc.name} (${e.need} mm)`;
      const code =
        e.kind === 'chair'
          ? 'chair-space-blocked'
          : e.kind === 'service'
            ? 'service-zone-blocked'
            : 'installation-blocked';
      if (hits.length) flag('warning', code, `${what}: ${hits[0]} is in the way.`);
      if (room && !install) {
        const b = e.box;
        if (!rectInside(room.outline, b.x, b.z, b.x + b.w, b.z + b.d))
          flag('warning', code, `${what}: it runs into a wall.`);
      }
      if (room && install && e.box.y + e.box.h > room.height) {
        const over = e.box.y + e.box.h - room.height;
        if (pc.zones?.lyingDown)
          flag(
            'error',
            'installation-height',
            `${pc.name} is assembled lying down but cannot be stood up: it needs ${e.box.y + e.box.h} mm of height (its diagonal), ${over} mm more than the room's ${room.height} mm. Assemble it standing or make it lower.`,
          );
        else
          flag(
            'warning',
            'installation-height',
            `${pc.name} cannot be tipped up from lying on its back: it needs ${e.box.y + e.box.h} mm of height (its diagonal), ${over} mm more than the room's ${room.height} mm. Assemble it standing up in place.`,
          );
      }
      severity.set(e, worst);
    }
  return { diagnostics, severity };
}

/** A zone on the plan's Clearances overlay (ADR-073), coloured by its worst problem. */
export interface ClearanceZone {
  itemId: string;
  kind: 'body' | 'door' | 'drawer' | 'flap' | 'chair' | 'service';
  label: string;
  box: Box;
  severity: Severity;
}

export const worse = (a: Severity, b: Severity): Severity =>
  a === 'error' || b === 'error'
    ? 'error'
    : a === 'warning' || b === 'warning'
      ? 'warning'
      : 'none';

/** Diagnostic codes about a piece's own body (where it stands, how it goes in); they colour its body zone. */
export const BODY_CODES = new Set([
  'pieces-overlap',
  'below-floor',
  'outside-room',
  'hits-obstacle',
  'blocks-door',
  'covers-window',
  'installation-blocked',
  'installation-height',
]);

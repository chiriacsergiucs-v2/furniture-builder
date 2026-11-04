/**
 * Stored connections between touching pieces (ADR-168, research "connection hierarchy"): a snap or the Connected
 * toggle records that two pieces standing side by side are joined. The pair is re-checked on every build — it must
 * still touch side by side and pass every refusing compatibility rule (ADR-100) — and warned about when it no longer
 * does. Connected pieces move together, as grouped pieces do (ADR-148). Pure: documents in, documents out.
 */
import { t } from './i18n';
import { newId } from './design';
import { evaluate, sideJoin, touchSideBySide } from './compat';
import { carryGroups } from './groupMove';
import { groupOf } from './selection';
import { pieceName, placeItem, type MoveResult, type PlacedPiece, type Project } from './project';
import type { Diagnostic } from './types';

export interface Connection {
  id: string;
  /** The two pieces, in the order they were connected. */
  itemIds: [string, string];
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** The stored connection between `a` and `b`, if any. */
export const connectionOf = (project: Project, a: string, b: string): Connection | undefined =>
  project.connections?.find((c) => pairKey(c.itemIds[0], c.itemIds[1]) === pairKey(a, b));

export const isConnected = (project: Project, a: string, b: string) =>
  !!connectionOf(project, a, b);

/** The ids connected to `id`, in connection order. */
export function connectedTo(project: Project, id: string): string[] {
  const out: string[] = [];
  for (const c of project.connections ?? []) {
    if (c.itemIds[0] === id && !out.includes(c.itemIds[1])) out.push(c.itemIds[1]);
    if (c.itemIds[1] === id && !out.includes(c.itemIds[0])) out.push(c.itemIds[0]);
  }
  return out;
}

/**
 * Can `a` and `b` be connected? Both in the project and different, standing side by side (`touchSideBySide`), and
 * no refusing rule of ADR-100 fails for the pair. `pieces` saves placing them again when the caller has them.
 */
export function connectionCheck(
  project: Project,
  a: string,
  b: string,
  pieces?: readonly PlacedPiece[],
): { reason: string | null } {
  if (a === b) return { reason: t('A piece cannot be connected to itself.') };
  const find = (id: string) => {
    const pc = pieces?.find((x) => x.item.id === id);
    if (pc) return pc;
    const it = project.items.find((i) => i.id === id);
    return it ? placeItem(it) : undefined;
  };
  const pa = find(a),
    pb = find(b);
  if (!pa || !pb) return { reason: t('A connected piece was removed.') };
  if (!touchSideBySide(pa, pb))
    return {
      reason: t('{a} and {b} do not stand side by side.', {
        a: pa.item.design.name,
        b: pb.item.design.name,
      }),
    };
  const refused = evaluate('snap', sideJoin(pa, pb)).find((f) => f.rule.severity === 'refuse');
  return { reason: refused ? refused.message : null };
}

/** Connect `a` and `b` (no check: the caller decides). The same project when they already are. */
export function connect(project: Project, a: string, b: string): Project {
  if (a === b || isConnected(project, a, b)) return project;
  return {
    ...project,
    connections: [...(project.connections ?? []), { id: newId(), itemIds: [a, b] }],
  };
}

/** Remove the connection between `a` and `b`; the same project when there is none. */
export function disconnect(project: Project, a: string, b: string): Project {
  const c = connectionOf(project, a, b);
  if (!c) return project;
  return withConnections(
    project,
    project.connections!.filter((x) => x !== c),
  );
}

function withConnections(project: Project, connections: Connection[]): Project {
  const { connections: _was, ...rest } = project;
  void _was;
  return connections.length ? { ...rest, connections } : rest;
}

/** Keep only connections whose two pieces are still in the project. Same object when unchanged. */
export function pruneConnections(project: Project): Project {
  if (!project.connections) return project;
  const ids = new Set(project.items.map((i) => i.id));
  const seen = new Set<string>();
  const kept = project.connections.filter((c) => {
    const [a, b] = c.itemIds;
    const k = pairKey(a, b);
    if (a === b || !ids.has(a) || !ids.has(b) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return kept.length === project.connections.length ? project : withConnections(project, kept);
}

/**
 * Settle the connections of pieces that were just dropped (ADR-168): a connection they no longer satisfy goes
 * (dragged apart); when the drop snapped, every valid side-by-side neighbour of a moved piece becomes connected.
 * Same object when nothing changes.
 */
export function settleConnections(
  project: Project,
  movedIds: readonly string[],
  snapped: boolean,
  pieces?: readonly PlacedPiece[],
): Project {
  const moved = new Set(movedIds);
  let next = project;
  const placed = new Map<string, PlacedPiece>();
  const place = (id: string) => {
    let pc = placed.get(id) ?? pieces?.find((x) => x.item.id === id);
    if (!pc) {
      const it = project.items.find((i) => i.id === id);
      if (!it) return undefined;
      pc = placeItem(it);
    }
    placed.set(id, pc);
    return pc;
  };
  for (const c of project.connections ?? []) {
    const [a, b] = c.itemIds;
    if (!moved.has(a) && !moved.has(b)) continue;
    const pa = place(a),
      pb = place(b);
    if (!pa || !pb || !touchSideBySide(pa, pb)) next = disconnect(next, a, b);
  }
  if (!snapped) return next;
  for (const id of movedIds) {
    const me = place(id);
    if (!me) continue;
    for (const other of project.items) {
      if (other.id === id || isConnected(next, id, other.id)) continue;
      const pc = place(other.id);
      if (!pc || !touchSideBySide(me, pc)) continue;
      if (connectionCheck(project, id, other.id, [me, pc]).reason === null)
        next = connect(next, id, other.id);
    }
  }
  return next;
}

/** A warning for every connection that no longer holds (ADR-008: never an error). */
export function connectionDiagnostics(
  project: Project,
  pieces?: readonly PlacedPiece[],
): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const c of project.connections ?? []) {
    const [a, b] = c.itemIds;
    const { reason } = connectionCheck(project, a, b, pieces);
    if (!reason) continue;
    out.push({
      severity: 'warning',
      code: 'connection-broken',
      message: t('{a} and {b} are connected but no longer joined: {reason}', {
        a: pieceName(project, a),
        b: pieceName(project, b),
        reason,
      }),
      nodeId: b,
      itemIds: [a, b],
    });
  }
  return out;
}

/**
 * Every piece that moves with one of `ids`: through its group (ADR-148) and its connections (ADR-168), repeatedly,
 * with `ids` first. Without `connections`, groups only (`withGroups`).
 */
export function movingSet(project: Project, ids: readonly string[], connections = true): string[] {
  const out = [...ids];
  for (let i = 0; i < out.length; i++) {
    const id = out[i];
    for (const m of groupOf(project, id)?.itemIds ?? []) if (!out.includes(m)) out.push(m);
    if (connections) for (const m of connectedTo(project, id)) if (!out.includes(m)) out.push(m);
  }
  return out;
}

/** The project with its groups replaced by the units that move together: groups joined with connections. */
function asUnits(project: Project): Project {
  const seen = new Set<string>();
  const groups: NonNullable<Project['groups']> = [];
  for (const it of project.items) {
    if (seen.has(it.id)) continue;
    const unit = movingSet(project, [it.id]);
    unit.forEach((x) => seen.add(x));
    if (unit.length > 1) groups.push({ id: `unit:${it.id}`, name: '', itemIds: unit });
  }
  return { ...project, groups };
}

/**
 * Carry a change to whole moving units — groups and connected pieces together (ADR-148, ADR-168) — as `carryGroups`
 * does for groups alone. The real groups come back unchanged.
 */
export function carryUnits(
  before: Project,
  after: Project,
  lead: readonly string[] = [],
): MoveResult {
  if (!before.connections?.length) return carryGroups(before, after, lead);
  const units = asUnits(before);
  const res = carryGroups(units, { ...after, groups: units.groups }, lead);
  if (res.reason) return { project: before, reason: res.reason };
  const { groups: _u, ...rest } = res.project;
  void _u;
  return { project: before.groups ? { ...rest, groups: before.groups } : rest };
}

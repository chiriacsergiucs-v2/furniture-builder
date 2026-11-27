// G-420: runs of base units (Suggest run parts, ADR-061; run handles, ADR-125; "the run" scope) read the stored side
// and corner connections (ADR-168, ADR-207); without connections they are the touching runs as before (ADR-036).
import { describe, expect, it } from 'vitest';
import { connect, connectWall } from '../src/core/connections';
import { templates } from '../src/core/design';
import {
  groupRunLegs,
  groupRuns,
  makeItem,
  newProject,
  placeItem,
  resolvePlacements,
  runHandleMembers,
  runOf,
  suggestRunParts,
  type Project,
  type ProjectItem,
} from '../src/core/project';
import { requestCandidates } from '../src/core/projectWorktops';
import type { Design } from '../src/core/types';
import { withCab } from './helpers/cabinet';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const ids = (p: Project) => p.items.map((i) => i.id);
const placed = (p: Project) => resolvePlacements(p).items.map((i) => placeItem(i));
const runIds = (p: Project, withConnections = true) =>
  groupRuns(placed(p), withConnections ? p.connections : undefined).map((r) =>
    r.map((pc) => pc.item.id),
  );

function row(...designs: Design[]): Project {
  let p = newProject('Runs');
  for (const d of designs) p = { ...p, items: [...p.items, makeItem(p, d)] };
  return p;
}
const patch = (p: Project, id: string, change: Partial<ProjectItem>): Project => ({
  ...p,
  items: p.items.map((i) => (i.id === id ? { ...i, ...change } : i)),
});
/** Move the piece so its outline's left-back corner is at (x, z). */
function putAt(p: Project, id: string, x: number, z: number): Project {
  const it = p.items.find((i) => i.id === id)!;
  const b = placeItem(it).bounds;
  return patch(p, id, {
    position: { ...it.position, x: it.position.x + x - b.x, z: it.position.z + z - b.z },
  });
}
/** A along the back wall, B turned a quarter at A's right end: they meet in a corner. */
function cornerPair(): Project {
  let p = row(t('base-door'), t('base-door'));
  const [a, b] = ids(p);
  p = putAt(p, a, 0, 0);
  p = patch(p, b, { rotationY: 90 });
  return putAt(p, b, 600, 0);
}
/**
 * A deep base unit A, then two shallow ones at A's right end: X pulled forward, P against the back. Both touch A, but
 * the touching rule follows the run's last piece (X), so P starts a run of its own.
 */
function forkRow(): Project {
  const base = t('base-door');
  let p = row(base, withCab(base, { depth: 250 }), withCab(base, { depth: 300 }));
  const [a, x, q] = ids(p);
  p = putAt(p, a, 0, 0);
  p = putAt(p, x, 600, 310);
  return putAt(p, q, 600, 0);
}

describe('runs read side and corner connections (G-420)', () => {
  it('corner: pieces connected in a corner form one run, each turn its own leg', () => {
    const p0 = cornerPair();
    const [a, b] = ids(p0);
    // Not connected: two runs, as the touching rule finds them.
    expect(runIds(p0)).toEqual([[a], [b]]);
    expect(runOf(p0, b)).toEqual([b]);
    const p = connect(p0, a, b, 'corner');
    expect(p.connections![0].kind).toBe('corner');
    expect(runIds(p)).toEqual([[a, b]]);
    expect(runIds(p, false)).toEqual([[a], [b]]);
    expect(
      groupRunLegs(placed(p), p.connections).map((r) =>
        r.map((leg) => leg.map((pc) => pc.item.id)),
      ),
    ).toEqual([[[a], [b]]]);
    expect(runOf(p, b)).toEqual([a, b]);
    expect(runHandleMembers(p, { id: 'rh', from: [a], handle: { kind: 'bar' } } as never)).toEqual([
      a,
      b,
    ]);
    // A worktop request still picks one leg.
    expect(requestCandidates(p).runs).toEqual([[a], [b]]);
  });

  it('corner: Suggest run parts plans the side leg with the back leg it is connected to', () => {
    const p0 = cornerPair();
    const [a, b] = ids(p0);
    const from = (p: Project) => suggestRunParts(p).flatMap((rp) => rp.from ?? []);
    // Not connected: the side-wall run gets no parts unless asked (ADR-205).
    expect(from(p0)).toContain(a);
    expect(from(p0)).not.toContain(b);
    const p = connect(p0, a, b, 'corner');
    const parts = suggestRunParts(p);
    expect(parts.flatMap((rp) => rp.from ?? [])).toContain(b);
    // Each leg keeps its own parts: none spans both turns.
    for (const rp of parts) expect(rp.from?.includes(a) && rp.from?.includes(b)).toBeFalsy();
  });

  it('side: a side connection joins pieces the touching rule splits into one leg', () => {
    const p0 = forkRow();
    const [a, x, q] = ids(p0);
    expect(runIds(p0)).toEqual([[a, x], [q]]);
    const p = connect(p0, a, q);
    expect(p.connections![0].kind).toBeUndefined();
    expect(runIds(p)).toEqual([[a, x, q]]);
    expect(groupRunLegs(placed(p), p.connections)).toHaveLength(1);
    expect(groupRunLegs(placed(p), p.connections)[0]).toHaveLength(1);
    expect(runOf(p, q)).toEqual([a, x, q]);
  });

  it('unconnected, wall, stacked and broken connections leave the runs as the touching rule finds them', () => {
    const p0 = cornerPair();
    const [a, b] = ids(p0);
    const before = runIds(p0);
    // A corner connection that no longer holds (B moved away) joins nothing; its warning stays (ADR-168).
    const apart = putAt(connect(p0, a, b, 'corner'), b, 900, 0);
    expect(runIds(apart)).toEqual(runIds(apart, false));
    // A wall connection joins nothing.
    const wall = connectWall(p0, a, 0);
    expect(runIds(wall)).toEqual(before);
    // A connection to a piece that is not a base unit joins nothing.
    let s = row(t('base-door'), t('wall-cabinet'), t('base-door'));
    const [base, wu, other] = ids(s);
    s = putAt(s, base, 0, 0);
    s = putAt(s, wu, 0, 0);
    s = putAt(s, other, 2000, 0);
    const stacked = connect(s, base, wu, 'stacked');
    expect(runIds(stacked)).toEqual([[base], [other]]);
    // A plain row: the same runs with or without the (absent) connections.
    const plain = row(t('base-door'), t('base-door'), t('base-door'));
    expect(runIds(plain)).toEqual([ids(plain)]);
  });
});

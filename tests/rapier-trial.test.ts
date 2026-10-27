/**
 * Rapier trial (ADR-125, G-165: a measured trial first, nothing shipped in the app). Opt-in, not part of `pnpm test`:
 * `RAPIER_TRIAL=1 pnpm exec vitest run tests/rapier-trial.test.ts`. Builds the sample project and 300 shuffled layouts
 * of its pieces, finds the overlapping piece pairs with today's checks (bounding boxes, then `panelsOverlap`) and with
 * Rapier scene queries over the panels' boxes, and prints agreement and time. Rapier is a devDependency only.
 */
import { describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { overlaps } from '../src/core/geometry';
import { placeItem, resolvePlacements, type PlacedPiece, type Project } from '../src/core/project';
import { aabbOf, panelsOverlap } from '../src/core/shape';
import { mobilaLiving } from '../src/core/samples/mobila';

const SHIFT = Number(process.env.RAPIER_SHIFT ?? 400);
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Today's rule, as `buildProjectModel` runs it: outlines first, then panels. */
function boxPairs(pieces: PlacedPiece[]): Set<string> {
  const out = new Set<string>();
  for (let a = 0; a < pieces.length; a++)
    for (let b = a + 1; b < pieces.length; b++)
      if (
        overlaps(pieces[a].bounds, pieces[b].bounds) &&
        pieces[a].panels.some((p) => pieces[b].panels.some((q) => panelsOverlap(p, q)))
      )
        out.add(pairKey(pieces[a].item.id, pieces[b].item.id));
  return out;
}

/**
 * Rapier: one fixed cuboid collider per panel box, shrunk 0.5 mm per side so faces that only touch (allowed) do
 * not count; whole-mm geometry means a real overlap is at least 1 mm.
 */
function rapierPairs(pieces: PlacedPiece[]): Set<string> {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  const owner = new Map<number, string>();
  const cuboid = (b: { x: number; y: number; z: number; w: number; h: number; d: number }) => ({
    shape: new RAPIER.Cuboid(b.w / 2 - 0.5, b.h / 2 - 0.5, b.d / 2 - 0.5),
    at: { x: b.x + b.w / 2, y: b.y + b.h / 2, z: b.z + b.d / 2 },
  });
  for (const pc of pieces)
    for (const p of pc.panels) {
      const b = aabbOf(p);
      const c = world.createCollider(
        RAPIER.ColliderDesc.cuboid(b.w / 2 - 0.5, b.h / 2 - 0.5, b.d / 2 - 0.5).setTranslation(
          b.x + b.w / 2,
          b.y + b.h / 2,
          b.z + b.d / 2,
        ),
      );
      owner.set(c.handle, pc.item.id);
    }
  world.step(); // builds the broad phase the scene queries use
  const out = new Set<string>();
  for (const pc of pieces)
    for (const p of pc.panels) {
      const { shape, at } = cuboid(aabbOf(p));
      world.intersectionsWithShape(at, { x: 0, y: 0, z: 0, w: 1 }, shape, (c) => {
        const other = owner.get(c.handle);
        if (other && other !== pc.item.id) out.add(pairKey(pc.item.id, other));
        return true;
      });
    }
  world.free();
  return out;
}

/** Deterministic layouts: the sample's pieces moved along the wall and in depth by up to ±SHIFT mm (default 400). */
function layouts(n: number): Project[] {
  const base = mobilaLiving();
  let seed = 125;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * 2 - 1;
  const out: Project[] = [base];
  for (let i = 1; i < n; i++)
    out.push({
      ...base,
      items: base.items.map((it) => ({
        ...it,
        placement: undefined,
        position: {
          x: Math.max(0, it.position.x + Math.round(rnd() * SHIFT)),
          y: it.position.y,
          z: Math.max(0, it.position.z + Math.round(rnd() * SHIFT)),
        },
      })),
    });
  return out;
}

describe.runIf(process.env.RAPIER_TRIAL)('Rapier trial (ADR-125)', () => {
  it('compares overlap answers and time with the box checks', async () => {
    await RAPIER.init();
    const placed = layouts(300).map((p) =>
      resolvePlacements(p).items.map((i) => placeItem(i)),
    );
    let t = performance.now();
    const ours = placed.map(boxPairs);
    const tOurs = performance.now() - t;
    t = performance.now();
    const theirs = placed.map(rapierPairs);
    const tRapier = performance.now() - t;
    let agree = 0,
      overlapping = 0;
    const differ: string[] = [];
    ours.forEach((a, i) => {
      const b = theirs[i];
      if (a.size) overlapping++;
      if (a.size === b.size && [...a].every((k) => b.has(k))) agree++;
      else differ.push(`layout ${i}: box ${[...a].length} pairs, rapier ${[...b].length} pairs`);
    });
    const panels = placed.reduce((n, ps) => n + ps.reduce((m, pc) => m + pc.panels.length, 0), 0);
    console.log(
      JSON.stringify(
        {
          layouts: placed.length,
          withOverlaps: overlapping,
          panels,
          agree,
          differ: differ.slice(0, 5),
          boxMs: Math.round(tOurs),
          rapierMs: Math.round(tRapier),
        },
        null,
        1,
      ),
    );
    expect(agree + differ.length).toBe(placed.length);
  });
});

// The run handle that reaches a project piece (ADR-203, G-211): `runHandleFor` answers which run handle sets the
// piece's handles, as `applyRunHandles` applies them, so the piece editor can show it read-only.
import { describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import {
  applyRunHandles,
  makeItem,
  newProject,
  runHandleFor,
  type Project,
  type RunHandle,
} from '../src/core/project';
import type { Design } from '../src/core/types';

const t = (id: string) => templates.find((x) => x.id === id)!.create();

/** Base units side by side on the floor, left to right. */
function run(designs: Design[]): Project {
  let p = newProject('Run');
  for (const d of designs) p = { ...p, items: [...p.items, makeItem(p, d)] };
  return p;
}
const bar = (id: string, from: string[], patch: Partial<RunHandle> = {}): RunHandle => ({
  id,
  from,
  handle: { kind: 'bar', holeSpacing: 160 },
  height: 600,
  ...patch,
});

describe('runHandleFor (ADR-203, G-211)', () => {
  it('returns the run handle for every piece of its run, not only the ones it was made from', () => {
    const p0 = run([t('base-door'), t('base-door'), t('base-door')]);
    const [a, b, c] = p0.items.map((i) => i.id);
    const rh = bar('rh1', [a]);
    const p = { ...p0, runHandles: [rh] };
    expect(runHandleFor(p, a)).toBe(rh);
    expect(runHandleFor(p, b)).toBe(rh);
    expect(runHandleFor(p, c)).toBe(rh);
  });

  it('a piece keeping its own handles, a piece off the run, an unknown id and no run handles give none', () => {
    const p0 = run([t('base-door'), t('base-door')]);
    const [a, b] = p0.items.map((i) => i.id);
    const p = { ...p0, runHandles: [bar('rh1', [a, b], { own: [b] })] };
    expect(runHandleFor(p, a)?.id).toBe('rh1');
    expect(runHandleFor(p, b)).toBeUndefined();
    expect(runHandleFor(p, 'nope')).toBeUndefined();
    expect(runHandleFor(p0, a)).toBeUndefined();
    // Moved far away along the wall, b leaves the run: the run handle no longer reaches it.
    const apart: Project = {
      ...p,
      runHandles: [bar('rh1', [a])],
      items: p.items.map((i) =>
        i.id === b ? { ...i, position: { ...i.position, x: i.position.x + 3000 } } : i,
      ),
    };
    expect(runHandleFor(apart, a)?.id).toBe('rh1');
    expect(runHandleFor(apart, b)).toBeUndefined();
  });

  it('agrees with what is built: the first run handle that does not exclude the piece wins', () => {
    const p0 = run([t('base-door'), t('base-door')]);
    const [a, b] = p0.items.map((i) => i.id);
    const first = bar('rh1', [a], { own: [b] });
    const second = bar('rh2', [b], { handle: { kind: 'knob' } });
    const p = { ...p0, runHandles: [first, second] };
    expect(runHandleFor(p, a)).toBe(first);
    expect(runHandleFor(p, b)).toBe(second);
    const built = applyRunHandles(p);
    const handleOf = (id: string) => {
      const d = built.items.find((i) => i.id === id)!.design;
      return d.product.kind === 'cabinet' ? JSON.stringify(d.product) : '';
    };
    expect(handleOf(a)).toContain('"holeSpacing":160');
    expect(handleOf(b)).toContain('"kind":"knob"');
    // The stored designs keep their own handles (decision 4: the piece's own handles stay in its design).
    expect(p.items.map((i) => i.design)).toEqual(p0.items.map((i) => i.design));
  });
});

// The drag budget of the 3D view (ADR-295): full quality unless a drag's frames are measured slow, never below
// MIN_ORBIT_DPR, pauses not counted, ratio raised back when frames are fast; the camera-independent work it skips.
import { BoxGeometry, Group, Mesh, Vector3, Matrix4 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MergedEdges } from '../src/viewer/panelResources';
import {
  FAST_FRAME_MS,
  FULL_BUDGET,
  HOLD_WINDOWS,
  MIN_ORBIT_DPR,
  PAUSE_MS,
  SLOW_FRAME_MS,
  TAP_SLOP_PX,
  isOrbiting,
  nextBudget,
  orbitMoved,
  orbitReleased,
  pressDown,
  pressMoved,
  pressWasDrag,
  resetOrbitBudget,
  sameSignature,
  setOrbiting,
  shadowSignature,
} from '../src/viewer/orbiting';

const feed = (frames: number[], dpr = 2, ao = false, edges = false, from = FULL_BUDGET) =>
  frames.reduce((b, ms) => nextBudget(b, ms, dpr, ao, edges), from);
const window6 = (ms: number) => Array<number>(6).fill(ms);

describe('orbit budget', () => {
  beforeEach(() => resetOrbitBudget());

  it('keeps full quality while frames are fast', () => {
    expect(feed(Array(12).fill(FAST_FRAME_MS - 2)).scale).toBe(1);
  });

  it('lowers the ratio after slow frames, never below the minimum', () => {
    const b = feed(Array(60).fill(SLOW_FRAME_MS * 5));
    expect(b.scale).toBeLessThan(1);
    expect(b.scale * 2).toBeGreaterThanOrEqual(MIN_ORBIT_DPR - 1e-9);
  });

  it('skips ambient occlusion before it lowers the ratio', () => {
    const b = feed(Array(6).fill(SLOW_FRAME_MS + 10), 2, true);
    expect(b.skipOcclusion).toBe(true);
    expect(b.scale).toBe(1);
  });

  it('does not count a pause as a slow frame', () => {
    expect(feed(Array(12).fill(PAUSE_MS + 1))).toEqual(FULL_BUDGET);
  });

  it('steps back up on a fast 60 Hz screen (16.7 ms frames)', () => {
    const low = feed(Array(12).fill(SLOW_FRAME_MS * 3));
    const up = [...Array(6)].reduce((b) => nextBudget(b, 1000 / 60, 2, false), low);
    expect(up.scale).toBeGreaterThan(low.scale);
  });

  it('raises the ratio back when frames are fast again', () => {
    const low = feed(Array(12).fill(SLOW_FRAME_MS * 3));
    const up = [...Array(6)].reduce((b) => nextBudget(b, FAST_FRAME_MS - 4, 2, false), low);
    expect(up.scale).toBeGreaterThan(low.scale);
  });

  it('draws the edges thin before it lowers the ratio, after ambient occlusion', () => {
    const ao = feed(window6(SLOW_FRAME_MS + 10), 2, true, true);
    expect(ao).toMatchObject({ skipOcclusion: true, thinEdges: false, scale: 1 });
    const thin = feed(window6(SLOW_FRAME_MS + 10), 2, true, true, ao);
    expect(thin).toMatchObject({ thinEdges: true, scale: 1 });
    expect(feed(window6(SLOW_FRAME_MS + 10), 2, true, true, thin).scale).toBeLessThan(1);
    // Without edges in the view (the realistic look), the ratio goes down right after occlusion.
    expect(feed(window6(SLOW_FRAME_MS + 10), 2, true, false, ao).scale).toBeLessThan(1);
  });

  it('does not climb back into a ratio measured slow until the hold has passed', () => {
    // Slow at 0.8 of the ratio: it steps down, and fast frames then hold it a step below 0.8.
    const start = { ...FULL_BUDGET, scale: 0.8, thinEdges: true };
    const down = feed(window6(SLOW_FRAME_MS + 4), 2, false, true, start);
    expect(down.scale).toBeLessThan(0.8);
    const held = feed(Array<number>(6 * (HOLD_WINDOWS - 1)).fill(1000 / 60), 2, false, true, down);
    expect(held.scale).toBeLessThanOrEqual(0.8 * 0.85 + 1e-9);
    // Once the hold is over, the ratio is tried again.
    const lifted = feed(Array<number>(6 * 3).fill(1000 / 60), 2, false, true, held);
    expect(lifted.scale).toBeGreaterThan(held.scale);
  });

  it('brings the fat edges back only at the full ratio', () => {
    const reduced = { ...FULL_BUDGET, scale: 0.6, thinEdges: true };
    const up = feed(window6(1000 / 60), 2, false, true, reduced);
    expect(up).toMatchObject({ thinEdges: true });
    expect(up.scale).toBeGreaterThan(0.6);
    const full = feed(window6(1000 / 60), 2, false, true, { ...reduced, scale: 1 });
    expect(full).toMatchObject({ scale: 1, thinEdges: false });
  });
});

describe('turning and the camera moving', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    setOrbiting(false);
    vi.useRealTimers();
  });

  it('ends turning once the glide has been still for a moment, not on every move', () => {
    orbitMoved(true);
    expect(isOrbiting()).toBe(true);
    orbitReleased();
    // The glide keeps moving the camera: turning goes on.
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(50);
      orbitMoved(false);
    }
    expect(isOrbiting()).toBe(true);
    vi.advanceTimersByTime(200);
    expect(isOrbiting()).toBe(false);
  });

  it('a wheel notch (a move with no press) does not start turning', () => {
    orbitMoved(false);
    expect(isOrbiting()).toBe(false);
  });
});

describe('a press that travelled is a drag, not a tap', () => {
  beforeEach(() => resetOrbitBudget());

  it('a tap with a little jitter is still a tap', () => {
    pressDown(100, 100);
    pressMoved(103, 98);
    expect(pressWasDrag()).toBe(false);
  });

  it('a press that went further than the slop is a drag, even back where it started', () => {
    pressDown(100, 100);
    pressMoved(100 + TAP_SLOP_PX + 5, 100);
    pressMoved(100, 100);
    expect(pressWasDrag()).toBe(true);
    // The next press starts afresh.
    pressDown(50, 50);
    expect(pressWasDrag()).toBe(false);
  });
});

describe('the floor shadow is drawn again only when the pieces moved', () => {
  const scene = () => {
    const g = new Group();
    g.add(new Mesh(new BoxGeometry(1, 1, 1)), new Mesh(new BoxGeometry(2, 1, 1)));
    g.updateMatrixWorld(true);
    return g;
  };

  it('the same pieces in the same places have the same signature', () => {
    const g = scene();
    expect(sameSignature(shadowSignature(g), shadowSignature(g))).toBe(true);
    expect(sameSignature(null, shadowSignature(g))).toBe(false);
  });

  it('a moved, hidden or replaced piece changes it', () => {
    const g = scene();
    const before = shadowSignature(g);
    const [a, b] = g.children as Mesh[];
    a.position.copy(new Vector3(0, 0.5, 0));
    g.updateMatrixWorld(true);
    expect(sameSignature(before, shadowSignature(g))).toBe(false);
    a.position.set(0, 0, 0);
    g.updateMatrixWorld(true);
    expect(sameSignature(before, shadowSignature(g))).toBe(true);
    b.visible = false;
    expect(sameSignature(before, shadowSignature(g))).toBe(false);
    b.visible = true;
    b.geometry = new BoxGeometry(2, 1, 1);
    expect(sameSignature(before, shadowSignature(g))).toBe(false);
  });
});

describe('thin twins of the panel edges', () => {
  const item = (selected: boolean) => ({
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0]),
    matrix: new Matrix4(),
    selected,
    faded: false,
  });

  it('each plain line has a thin twin with the same points; the selection keeps its fat line', () => {
    const edges = new MergedEdges();
    const lines = edges.update(['a'], () => [item(false), item(true)]);
    expect(lines).toHaveLength(2);
    expect(edges.thin).toHaveLength(1);
    expect(edges.warm).toHaveLength(1);
    expect(Array.from(edges.thin[0].geometry.getAttribute('position').array)).toEqual([
      0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0,
    ]);
    const plain = lines.find((l) => l.material.linewidth === 1)!;
    const selected = lines.find((l) => l.material.linewidth !== 1)!;
    expect([plain.visible, edges.thin[0].visible]).toEqual([true, false]);
    edges.setThin(true);
    expect([plain.visible, selected.visible, edges.thin[0].visible]).toEqual([false, true, true]);
    edges.setThin(false);
    expect([plain.visible, edges.thin[0].visible]).toEqual([true, false]);
    // The unseen warm-up segment shares the twin's material and points, and sits far outside the view.
    expect(edges.warm[0].material).toBe(edges.thin[0].material);
    expect(edges.warm[0].geometry.getAttribute('position')).toBe(
      edges.thin[0].geometry.getAttribute('position'),
    );
    expect(edges.warm[0].geometry.drawRange.count).toBe(2);
    expect(edges.warm[0].position.y).toBeLessThan(-1000);
    expect(edges.warm[0].frustumCulled).toBe(false);
    const twinGeometry = vi.spyOn(edges.thin[0].geometry, 'dispose');
    const warmGeometry = vi.spyOn(edges.warm[0].geometry, 'dispose');
    edges.dispose();
    expect(twinGeometry).toHaveBeenCalledOnce();
    expect(warmGeometry).toHaveBeenCalledOnce();
    expect(edges.thin).toHaveLength(0);
  });

  it('a rebuild with new deps replaces the twins instead of adding to them', () => {
    const edges = new MergedEdges();
    edges.update(['a'], () => [item(false)]);
    const first = edges.thin[0];
    edges.update(['a'], () => [item(false)]);
    expect(edges.thin[0]).toBe(first);
    edges.update(['b'], () => [item(false)]);
    expect(edges.thin).toHaveLength(1);
    expect(edges.warm).toHaveLength(1);
    expect(edges.thin[0]).not.toBe(first);
    edges.setThin(true);
    expect(edges.thin[0].visible).toBe(true);
    expect(first.visible).toBe(false);
  });
});

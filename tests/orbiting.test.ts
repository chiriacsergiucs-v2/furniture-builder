// The drag budget of the 3D view (ADR-295): full quality unless a drag's frames are measured slow, never below
// MIN_ORBIT_DPR, pauses not counted, ratio raised back when frames are fast.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  FAST_FRAME_MS,
  FULL_BUDGET,
  MIN_ORBIT_DPR,
  PAUSE_MS,
  SLOW_FRAME_MS,
  nextBudget,
  resetOrbitBudget,
} from '../src/viewer/orbiting';

const feed = (frames: number[], dpr = 2, ao = false) =>
  frames.reduce((b, ms) => nextBudget(b, ms, dpr, ao), FULL_BUDGET);

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

  it('raises the ratio back when frames are fast again', () => {
    const low = feed(Array(12).fill(SLOW_FRAME_MS * 3));
    const up = [...Array(6)].reduce((b) => nextBudget(b, FAST_FRAME_MS - 4, 2, false), low);
    expect(up.scale).toBeGreaterThan(low.scale);
  });
});

// Diagonal corner doors are an exact split (ADR-003, G-616): the leaves share the diagonal opening less the end and
// meeting gaps to the millimetre, the leftover spread one millimetre per leaf from the left, as every other split.
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { cornerDefaults, wrap } from '../src/core/design';
import type { Design } from '../src/core/types';

function diagonal(width: number, count: 1 | 2): Design {
  const p = cornerDefaults('diagonal');
  return wrap('C', {
    kind: 'corner',
    id: 'C',
    params: { ...p, width, interior: { ...p.interior, front: { kind: 'doors', count } } },
  });
}

const doorWidths = (d: Design) =>
  buildModel(d)
    .panels.filter((x) => x.role === 'door')
    .map((x) => x.box.w);

describe('diagonal corner doors split the opening exactly (G-616)', () => {
  // Width 901, depth 560, front gap 3: the diagonal is round(√2 × 341) = 482 mm; less the 1 mm end gaps and the 3 mm
  // meeting gap the leaves share 477 mm.
  it('width 901, two doors: 239 + 238, no millimetre left to an end gap', () => {
    expect(doorWidths(diagonal(901, 2))).toEqual([239, 238]);
  });

  it('width 900, two doors: an even split stays 238 + 238', () => {
    expect(doorWidths(diagonal(900, 2))).toEqual([238, 238]);
  });

  it('one door takes the whole opening', () => {
    // round(√2 × 341) − 2 × 1 = 480
    expect(doorWidths(diagonal(901, 1))).toEqual([480]);
  });

  it('for any width the leaves fill the opening and differ by at most 1 mm', () => {
    for (let w = 880; w <= 1000; w++) {
      const widths = doorWidths(diagonal(w, 2));
      const span = Math.round(Math.SQRT2 * (w - 560));
      expect(widths[0] + widths[1]).toBe(span - 2 * 1 - 3);
      expect(widths[0] - widths[1]).toBeGreaterThanOrEqual(0);
      expect(widths[0] - widths[1]).toBeLessThanOrEqual(1);
    }
  });
});

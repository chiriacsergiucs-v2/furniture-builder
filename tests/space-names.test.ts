import { describe, expect, it } from 'vitest';
import { placed, spacePlace } from '../src/core/spaceNames';
import type { Space } from '../src/core/types';

const leaf = (id: string): Space => ({ id, kind: 'empty' }) as Space;
const split = (axis: 'x' | 'y', n: number): Space =>
  ({
    id: 'root',
    kind: 'split',
    axis,
    sizes: Array.from({ length: n }, () => ({ kind: 'fr', value: 1 })),
    children: Array.from({ length: n }, (_, i) => leaf(`c${i}`)),
  }) as unknown as Space;
const places = (root: Space, n: number) =>
  Array.from({ length: n }, (_, i) => spacePlace(root, `c${i}`));

describe('spacePlace (ADR-267)', () => {
  it('names two and three children of a vertical split by side', () => {
    expect(places(split('x', 2), 2)).toEqual(['Left', 'Right']);
    expect(places(split('x', 3), 3)).toEqual(['Left', 'Middle', 'Right']);
  });

  it('names two and three children of a horizontal split by height', () => {
    expect(places(split('y', 2), 2)).toEqual(['Top', 'Bottom']);
    expect(places(split('y', 3), 3)).toEqual(['Top', 'Middle', 'Bottom']);
  });

  it('numbers four or more children', () => {
    expect(places(split('x', 4), 4)).toEqual([
      'Bay 1 of 4',
      'Bay 2 of 4',
      'Bay 3 of 4',
      'Bay 4 of 4',
    ]);
    expect(places(split('y', 5), 5)[4]).toBe('Row 5 of 5');
  });

  it('gives the root and an unknown id no place, and placed() then returns the bare text', () => {
    const root = split('x', 2);
    expect(spacePlace(root, 'root')).toBeNull();
    expect(spacePlace(root, 'nope')).toBeNull();
    expect(placed(null, 'Shelves')).toBe('Shelves');
    expect(placed('Left', 'Shelves')).toBe('Left: Shelves');
  });
});

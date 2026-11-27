import { describe, expect, it } from 'vitest';
import { isHexColour, isInt } from '../src/core/guards';
import { isTile, MAX_TILE } from '../src/core/surface';

describe('shared input guards (G-570 M4)', () => {
  it('isHexColour takes #rrggbb in either case and nothing else', () => {
    expect(['#a1b2c3', '#A1B2C3'].map(isHexColour)).toEqual([true, true]);
    expect(['#abc', 'a1b2c3', '#a1b2c3d', '#g1b2c3', 0, undefined].map(isHexColour)).toEqual(
      Array(6).fill(false),
    );
  });
  it('isInt checks a safe integer within its bounds', () => {
    expect(isInt(5, 0, 10)).toBe(true);
    expect([isInt(11, 0, 10), isInt(-1, 0, 10), isInt(1.5), isInt('1')]).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
  it('isTile is whole mm from 1 to MAX_TILE', () => {
    expect([1, MAX_TILE].map(isTile)).toEqual([true, true]);
    expect([0, MAX_TILE + 1, 2.5].map(isTile)).toEqual([false, false, false]);
  });
});

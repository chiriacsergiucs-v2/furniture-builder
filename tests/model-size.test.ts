import { describe, expect, it } from 'vitest';
import { axisPoint } from '../src/core/drag3d';
import {
  dragResize,
  makeModelItem,
  modelBox,
  MODEL_SIDE_MAX,
  resizeModel,
  roomSide,
} from '../src/core/model3d';

/** Width, height and depth of an imported 3D model, each on its own (ADR-102). */
const fridge = { w: 600, h: 1800, d: 650 };

describe('resizing a 3D model (ADR-102)', () => {
  it('Keep proportions on: any side scales the other two by the same factor', () => {
    expect(resizeModel(fridge, 'w', 300, true)).toEqual({ w: 300, h: 900, d: 325 });
    expect(resizeModel(fridge, 'h', 900, true)).toEqual({ w: 300, h: 900, d: 325 });
    expect(resizeModel(fridge, 'd', 1300, true)).toEqual({ w: 1200, h: 3600, d: 1300 });
    // From a stretched size, the stretched proportions are the ones kept.
    expect(resizeModel({ w: 600, h: 2000, d: 650 }, 'w', 300, true)).toEqual({
      w: 300,
      h: 1000,
      d: 325,
    });
  });

  it('Keep proportions off: only the typed side changes', () => {
    expect(resizeModel(fridge, 'h', 2000, false)).toEqual({ w: 600, h: 2000, d: 650 });
    expect(resizeModel(fridge, 'w', 450, false)).toEqual({ w: 450, h: 1800, d: 650 });
    expect(resizeModel(fridge, 'd', 1, false)).toEqual({ w: 600, h: 1800, d: 1 });
  });

  it('every side stays at least 1 mm', () => {
    expect(resizeModel({ w: 1000, h: 2, d: 1 }, 'w', 1, true)).toEqual({ w: 1, h: 1, d: 1 });
  });

  it('a changed height changes only the height of the box in the room', () => {
    const item = makeModelItem('m1', { id: 'r1', name: 'Fridge', size: fridge }, 0);
    const box = modelBox({ ...item, size: resizeModel(item.size, 'h', 2000, false) });
    expect(box).toEqual({ x: 0, y: 0, z: 0, w: 600, h: 2000, d: 650 });
  });
});

describe('resize handles in 3D (ADR-102)', () => {
  it('a room axis maps to the side of the turned model', () => {
    expect(roomSide({ rotationY: 0 }, 'x')).toBe('w');
    expect(roomSide({ rotationY: 0 }, 'z')).toBe('d');
    expect(roomSide({ rotationY: 90 }, 'x')).toBe('d');
    expect(roomSide({ rotationY: 270 }, 'z')).toBe('w');
    expect(roomSide({ rotationY: 0, front: 'left' }, 'x')).toBe('d');
    expect(roomSide({ rotationY: 90 }, 'y')).toBe('h');
  });

  it('dragging the top handle changes only the height, or all three with Keep proportions', () => {
    expect(dragResize({ rotationY: 0 }, fridge, 'y', 200.4, false)).toEqual({
      w: 600,
      h: 2000,
      d: 650,
    });
    expect(dragResize({ rotationY: 0 }, fridge, 'y', -900, true)).toEqual({
      w: 300,
      h: 900,
      d: 325,
    });
  });

  it('dragging the right handle of a turned model changes its depth; the drag stays within 1 to the maximum', () => {
    expect(dragResize({ rotationY: 90 }, fridge, 'x', 50, false)).toEqual({
      w: 600,
      h: 1800,
      d: 700,
    });
    expect(dragResize({ rotationY: 0 }, fridge, 'z', -5000, false).d).toBe(1);
    expect(dragResize({ rotationY: 0 }, fridge, 'x', 1e6, false).w).toBe(MODEL_SIDE_MAX);
  });

  it('a pointer ray gives the point along the handle axis; parallel or behind gives null', () => {
    // Looking straight down from 3 m at x = 750: the vertical axis cannot be read, the x axis can.
    const down = {
      origin: [750, 3000, 400] as [number, number, number],
      dir: [0, -1, 0] as [number, number, number],
    };
    expect(axisPoint(down, [600, 900, 325], 'x')).toBeCloseTo(750);
    expect(axisPoint(down, [600, 900, 325], 'y')).toBeNull();
    // Looking along -z from the front at height 1200: the top handle's vertical axis reads 1200.
    const front = {
      origin: [300, 1200, 5000] as [number, number, number],
      dir: [0, 0, -2] as [number, number, number],
    };
    expect(axisPoint(front, [300, 1800, 325], 'y')).toBeCloseTo(1200);
    expect(axisPoint({ ...front, dir: [0, 0, 1] }, [300, 1800, 325], 'y')).toBeNull();
    expect(axisPoint({ ...front, dir: [NaN, 0, 1] }, [300, 1800, 325], 'y')).toBeNull();
  });
});

describe('Keep proportions switch (ADR-102)', () => {
  it('is on for a model, holds off until the selection changes, then is on again', async () => {
    const { keepProportionsNow, setKeepProportions } = await import('../src/ui/keepProportions');
    const { useDesign } = await import('../src/store/designStore');
    expect(keepProportionsNow('a')).toBe(true);
    setKeepProportions('a', false);
    expect(keepProportionsNow('a')).toBe(false);
    expect(keepProportionsNow('b')).toBe(true);
    useDesign.getState().selectItem('b');
    useDesign.getState().selectItem('a');
    expect(keepProportionsNow('a')).toBe(true);
  });
});

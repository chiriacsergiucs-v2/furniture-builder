import { describe, expect, it } from 'vitest';
import {
  NO_3D_REASON,
  PHONE_INLINE,
  bringDrawingForward,
  defaultView,
  inOptions,
  shows3d,
  showsDrawing,
  viewOptions,
} from '../src/ui/viewChoice';

describe('One view container: 2D · 3D · Both in both modes (ADR-144)', () => {
  it('offers 2D, 3D and Both, in a piece and in a project alike; no Plan or Front label', () => {
    const labels = viewOptions(true).map((o) => o.label);
    expect(labels).toEqual(['2D', '3D', 'Both']);
    expect(labels).not.toContain('Plan');
    expect(labels).not.toContain('Front');
    expect(viewOptions(true).some((o) => o.disabled)).toBe(false);
  });
  it('disables 3D and Both without WebGL, with the reason', () => {
    const opts = viewOptions(false);
    expect(opts.map((o) => o.disabled)).toEqual([false, true, true]);
    expect(opts.filter((o) => o.disabled).map((o) => o.reason)).toEqual([
      NO_3D_REASON,
      NO_3D_REASON,
    ]);
    expect(opts[0].reason).toBeUndefined();
  });
  it('defaults to 2D below 1500 px and Both from 1500 px, whatever the mode (G-268); 2D without WebGL', () => {
    expect(defaultView(false, true)).toBe('front'); // 390 and 1280 px
    expect(defaultView(true, true)).toBe('both'); // 1600 px
    expect(defaultView(true, false)).toBe('front');
    expect(defaultView(false, false)).toBe('front');
  });
  it('Both shows the drawing and 3D; only 3D and Both mount the canvas', () => {
    expect([shows3d('both'), showsDrawing('both')]).toEqual([true, true]);
    expect([shows3d('front'), showsDrawing('front')]).toEqual([false, true]);
    expect([shows3d('3d'), showsDrawing('3d')]).toEqual([true, false]);
  });
  it('placing or a tapped check brings the drawing forward from 3D and keeps Both', () => {
    expect(bringDrawingForward('3d')).toBe('front');
    expect(bringDrawingForward('both')).toBe('both');
    expect(bringDrawingForward('front')).toBe('front');
  });
  it('on a phone Fronts, Select, Move and Turn stay in the row; the rest go behind Options (G-269)', () => {
    expect([...PHONE_INLINE]).toEqual(['fronts', 'select', 'move', 'turn']);
    for (const t of PHONE_INLINE) expect(inOptions(t, true)).toBe(false);
    for (const t of ['snap', 'clearances', 'exploded', 'reset', 'look', 'render'] as const) {
      expect(inOptions(t, true)).toBe(true);
      expect(inOptions(t, false)).toBe(false);
    }
  });
});

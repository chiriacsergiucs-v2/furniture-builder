import { describe, expect, it } from 'vitest';
import {
  NO_3D_REASON,
  bringDrawingForward,
  defaultView,
  shows3d,
  showsDrawing,
  showsSwitch,
  shownView,
  viewOptions,
} from '../src/ui/viewChoice';

describe('View switch: Front · 3D · Both (ADR-081)', () => {
  it('offers Front, 3D and Both; Plan in a project', () => {
    expect(viewOptions(false, true).map((o) => o.label)).toEqual(['Front', '3D', 'Both']);
    expect(viewOptions(true, true).map((o) => o.label)).toEqual(['Plan', '3D', 'Both']);
    expect(viewOptions(false, true).some((o) => o.disabled)).toBe(false);
  });
  it('disables 3D and Both without WebGL, with the reason', () => {
    const opts = viewOptions(false, false);
    expect(opts.map((o) => o.disabled)).toEqual([false, true, true]);
    expect(opts.filter((o) => o.disabled).map((o) => o.reason)).toEqual([
      NO_3D_REASON,
      NO_3D_REASON,
    ]);
    expect(opts[0].reason).toBeUndefined();
  });
  it('defaults to Both from 1500 px, else by mode; the drawing without WebGL', () => {
    expect(defaultView('compose', true, true)).toBe('both');
    expect(defaultView('build', true, true)).toBe('both');
    expect(defaultView('compose', false, true)).toBe('front');
    expect(defaultView('build', false, true)).toBe('3d');
    expect(defaultView('build', true, false)).toBe('front');
  });
  it('on a phone offers the switch only in Build & Preview and shows only the drawing in Compose', () => {
    expect(showsSwitch('build', true)).toBe(true);
    expect(showsSwitch('compose', true)).toBe(false);
    expect(showsSwitch('compose', false)).toBe(true);
    expect(shownView('both', 'compose', true)).toBe('front');
    expect(shownView('both', 'build', true)).toBe('both');
    expect(shownView('3d', 'compose', false)).toBe('3d');
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
});

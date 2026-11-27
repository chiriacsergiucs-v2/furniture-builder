// @vitest-environment jsdom
// G-605: the 3D drag glue (ADR-295) tested without WebGL: the canvas's pointer-move filter, the press tracking of the
// orbit controls (Fit), the floor shadow's freeze and thaw (FloorShadow) and the thin twins of the panel edges built
// in an effect, so a StrictMode remount builds them again.
import { act, cleanup, renderHook } from '@testing-library/react';
import { StrictMode, createRef, type ReactNode } from 'react';
import { Group, Matrix4 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { skipDragMoves, trackPresses, useShadowFreeze, useThinTwins } from '../src/viewer/dragGlue';
import {
  TAP_SLOP_PX,
  isOrbiting,
  pressWasDrag,
  resetOrbitBudget,
  setOrbiting,
} from '../src/viewer/orbiting';
import { MergedEdges } from '../src/viewer/panelResources';

const pointer = (type: string, init: PointerEventInit) =>
  new PointerEvent(type, {
    bubbles: true,
    isPrimary: true,
    pointerId: 1,
    pointerType: 'mouse',
    ...init,
  });

afterEach(() => {
  cleanup();
  setOrbiting(false);
  resetOrbitBudget();
  vi.useRealTimers();
});

describe('the canvas skips the hover raycast mid-drag (orbitEvents)', () => {
  const manager = () => ({
    handlers: { onPointerMove: vi.fn<(e: Event) => void>(), onClick: vi.fn<(e: Event) => void>() },
  });

  it('a move with no button down raycasts; one with a button or finger down does not', () => {
    const m = manager();
    const out = skipDragMoves(m);
    out.handlers.onPointerMove(pointer('pointermove', { buttons: 0 }));
    expect(m.handlers.onPointerMove).toHaveBeenCalledOnce();
    out.handlers.onPointerMove(pointer('pointermove', { buttons: 1 }));
    expect(m.handlers.onPointerMove).toHaveBeenCalledOnce();
    // The other handlers are the manager's own.
    expect(out.handlers.onClick).toBe(m.handlers.onClick);
  });

  it('a move while the view turns (the damped glide, no button) does not raycast', () => {
    const m = manager();
    const out = skipDragMoves(m);
    setOrbiting(true);
    out.handlers.onPointerMove(pointer('pointermove', { buttons: 0 }));
    expect(m.handlers.onPointerMove).not.toHaveBeenCalled();
    setOrbiting(false);
    out.handlers.onPointerMove(pointer('pointermove', { buttons: 0 }));
    expect(m.handlers.onPointerMove).toHaveBeenCalledOnce();
  });

  it('a manager without a move handler is kept as it is', () => {
    const m = { handlers: undefined };
    expect(skipDragMoves(m)).toBe(m);
  });
});

describe('the presses on the view drive turning (Fit)', () => {
  let el: HTMLDivElement;
  let detach: () => void;
  let presses: ReturnType<typeof trackPresses>;
  beforeEach(() => {
    vi.useFakeTimers();
    el = document.createElement('div');
    document.body.append(el);
    presses = trackPresses();
    detach = presses.attach(el, window);
  });
  afterEach(() => {
    detach();
    el.remove();
  });

  it('a camera move while a pointer is pressed starts turning; the release ends it once the glide is still', () => {
    el.dispatchEvent(pointer('pointerdown', { clientX: 10, clientY: 10, buttons: 1 }));
    presses.onStart();
    presses.onChange();
    expect(isOrbiting()).toBe(true);
    window.dispatchEvent(pointer('pointerup', {}));
    presses.onEnd();
    expect(isOrbiting()).toBe(true);
    vi.advanceTimersByTime(300);
    expect(isOrbiting()).toBe(false);
  });

  it('a wheel notch (the controls start and change with no pointer down) does not start turning', () => {
    presses.onStart();
    presses.onChange();
    presses.onEnd();
    expect(isOrbiting()).toBe(false);
  });

  it('a pointer released before the camera moved does not count as pressed', () => {
    el.dispatchEvent(pointer('pointerdown', { clientX: 10, clientY: 10 }));
    window.dispatchEvent(pointer('pointercancel', {}));
    presses.onStart();
    presses.onChange();
    expect(isOrbiting()).toBe(false);
  });

  it('a mouse press that travelled past the slop is a drag; its next press starts afresh', () => {
    el.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 100 }));
    el.dispatchEvent(pointer('pointermove', { clientX: 100 + TAP_SLOP_PX + 1, clientY: 100 }));
    expect(pressWasDrag()).toBe(true);
    el.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 100 }));
    expect(pressWasDrag()).toBe(false);
    // A second finger's move does not count; nor does a move of a pointer that is not down.
    el.dispatchEvent(
      pointer('pointermove', { clientX: 300, clientY: 100, isPrimary: false, pointerId: 2 }),
    );
    window.dispatchEvent(pointer('pointerup', {}));
    el.dispatchEvent(pointer('pointermove', { clientX: 300, clientY: 100 }));
    expect(pressWasDrag()).toBe(false);
  });

  it('the cleanup removes every listener', () => {
    detach();
    el.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 100 }));
    el.dispatchEvent(pointer('pointermove', { clientX: 300, clientY: 100 }));
    expect(pressWasDrag()).toBe(false);
    presses.onStart();
    presses.onChange();
    expect(isOrbiting()).toBe(false);
  });
});

describe('the floor shadow freezes while the camera moves (FloorShadow)', () => {
  beforeEach(() => vi.useFakeTimers());

  const setup = () => {
    let sig = [1, 2, 3];
    const signature = vi.fn(() => sig);
    const redraw = vi.fn();
    const hook = renderHook(({ moving }) => useShadowFreeze(moving, signature, redraw), {
      initialProps: { moving: false },
      reactStrictMode: true,
    });
    return { hook, signature, redraw, move: (s: number[]) => (sig = s) };
  };

  it('freezes when the camera moves and thaws after the next still frame, with no redraw when nothing moved', () => {
    const { hook, signature, redraw } = setup();
    expect(hook.result.current.frozen).toBe(false);
    hook.rerender({ moving: true });
    expect(hook.result.current.frozen).toBe(true);
    expect(signature).toHaveBeenCalled();
    hook.rerender({ moving: false });
    // Still frozen in the still frame that only brings the full quality back.
    expect(hook.result.current.frozen).toBe(true);
    act(() => hook.result.current.frame());
    expect(hook.result.current.frozen).toBe(true);
    act(() => void vi.advanceTimersByTime(0));
    expect(hook.result.current.frozen).toBe(false);
    expect(redraw).not.toHaveBeenCalled();
  });

  it('asks for a redraw when the pieces moved while frozen', () => {
    const { hook, redraw, move } = setup();
    hook.rerender({ moving: true });
    move([1, 2, 4]);
    hook.rerender({ moving: false });
    act(() => hook.result.current.frame());
    act(() => void vi.advanceTimersByTime(0));
    expect(hook.result.current.frozen).toBe(false);
    expect(redraw).toHaveBeenCalledOnce();
  });

  it('thaws a moment later when no frame comes (a wheel notch)', () => {
    const { hook } = setup();
    hook.rerender({ moving: true });
    hook.rerender({ moving: false });
    act(() => void vi.advanceTimersByTime(99));
    expect(hook.result.current.frozen).toBe(true);
    act(() => void vi.advanceTimersByTime(1));
    expect(hook.result.current.frozen).toBe(false);
  });

  it('stays frozen when the camera moves again before the thaw', () => {
    const { hook } = setup();
    hook.rerender({ moving: true });
    hook.rerender({ moving: false });
    hook.rerender({ moving: true });
    act(() => hook.result.current.frame());
    act(() => void vi.advanceTimersByTime(500));
    expect(hook.result.current.frozen).toBe(true);
  });
});

describe('the thin twins are built in an effect (PanelEdges)', () => {
  const item = (selected: boolean) => ({
    positions: new Float32Array([0, 0, 0, 1, 0, 0]),
    matrix: new Matrix4(),
    selected,
    faded: false,
  });

  it('a StrictMode remount builds them again instead of leaving them emptied', () => {
    const edges = new MergedEdges();
    const lines = edges.update(['a'], () => [item(false), item(true)]);
    const group = createRef<Group>() as { current: Group | null };
    group.current = new Group();
    const changed = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const hook = renderHook(() => useThinTwins(lines, group, changed), { wrapper });
    const twins = hook.result.current.current!;
    // One twin and its warm-up segment, in the group, not disposed by the simulated unmount.
    expect(twins.thin).toHaveLength(1);
    expect(group.current.children).toEqual([twins.thin[0], twins.warm[0]]);
    expect(twins.thin[0].geometry.getAttribute('position')).toBeDefined();
    expect(changed).toHaveBeenCalled();
    const plain = lines.find((l) => l.material.linewidth === 1)!;
    twins.setThin(true);
    expect([plain.visible, twins.thin[0].visible]).toEqual([false, true]);
    hook.unmount();
    expect(group.current.children).toHaveLength(0);
    expect(hook.result.current.current).toBeNull();
    expect(plain.visible).toBe(true);
  });
});

// @vitest-environment jsdom
// AR, Export for AR and the render engine switch (ADR-208 items 7 and 8, N213), with the browser parts stubbed:
// `navigator.xr` decides whether View in AR is offered and receives the session request (`immersive-ar`, `hit-test`
// required, `dom-overlay` optional); Export for AR builds a USDZ (a zip holding a `.usda`) on this device with no
// request; the render engine is WebGPU with an adapter and WebGL 2 without. The real-device AR check (an Android phone
// and an iPhone) is not something a test can do; it stays with the user (ADR-208 Done when).
import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react';
import { BoxGeometry, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, Vector3 } from 'three';
import { unzipSync } from 'three/examples/jsm/libs/fflate.module.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// jsdom's Uint8Array is not the one Node's TextEncoder returns, so fflate (inside USDZExporter) would take the encoded
// .usda text for a folder. A browser has one realm; this gives the test the same.
vi.hoisted(() => {
  const Real = globalThis.TextEncoder;
  globalThis.TextEncoder = class extends Real {
    encode(s?: string) {
      return new Uint8Array(super.encode(s));
    }
  } as typeof TextEncoder;
});

// The AR bridge lives inside the 3D canvas; here it gets a stand-in renderer and scene.
const three = vi.hoisted(() => ({
  state: null as unknown,
  frame: null as null | ((s: unknown, d: number, f: unknown) => void),
}));
vi.mock('@react-three/fiber', () => ({
  useThree: (sel: (s: unknown) => unknown) => sel(three.state),
  useFrame: (f: (s: unknown, d: number, frame: unknown) => void) => {
    three.frame = f;
  },
  invalidate: () => {},
}));

const nav = navigator as unknown as Record<string, unknown>;
const setNav = (key: string, value: unknown) =>
  Object.defineProperty(navigator, key, { configurable: true, value });

afterEach(() => {
  cleanup();
  delete nav.xr;
  delete nav.gpu;
  vi.restoreAllMocks();
});

/** A WebXR system stand-in: says whether `immersive-ar` is supported and records the session requests. */
function stubXR(supported: boolean) {
  const ends = new Set<() => void>();
  const session = {
    end: vi.fn(async () => ends.forEach((f) => f())),
    addEventListener: (type: string, f: () => void) => type === 'end' && ends.add(f),
    removeEventListener: (type: string, f: () => void) => type === 'end' && ends.delete(f),
    requestReferenceSpace: vi.fn(async () => ({})),
    requestHitTestSource: vi.fn(async () => ({ cancel: () => {} })),
  };
  const xr = {
    isSessionSupported: vi.fn(async (mode: string) => supported && mode === 'immersive-ar'),
    requestSession: vi.fn(async () => session),
  };
  setNav('xr', xr);
  return { xr, session };
}

describe('View in AR (ADR-208 item 7)', () => {
  beforeEach(() => vi.resetModules());

  it('offered only when navigator.xr supports immersive-ar', async () => {
    const yes = stubXR(true);
    const ar = await import('../src/viewer/AR');
    const { result } = renderHook(() => ar.useARSupported());
    await waitFor(() => expect(result.current).toBe(true));
    expect(yes.xr.isSessionSupported).toHaveBeenCalledWith('immersive-ar');

    vi.resetModules();
    stubXR(false);
    const ar2 = await import('../src/viewer/AR');
    const r2 = renderHook(() => ar2.useARSupported());
    await act(async () => {});
    expect(r2.result.current).toBe(false);

    // No WebXR at all (most desktops): not offered, nothing thrown.
    vi.resetModules();
    delete nav.xr;
    const ar3 = await import('../src/viewer/AR');
    const r3 = renderHook(() => ar3.useARSupported());
    await act(async () => {});
    expect(r3.result.current).toBe(false);
  });

  it('requests an immersive-ar session with hit-test required and dom-overlay optional; Exit AR ends it', async () => {
    const { xr, session } = stubXR(true);
    const scene = new Scene();
    scene.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
    const gl = {
      xr: {
        enabled: false,
        setReferenceSpaceType: vi.fn(),
        setSession: vi.fn(async () => {}),
        getCamera: () => ({ position: new Vector3() }),
        getReferenceSpace: () => null,
      },
    };
    three.state = { gl, scene };
    const ar = await import('../src/viewer/AR');
    render(<ar.ARBridge bounds={{ x: 0, y: 0, z: 0, w: 600, h: 870, d: 560 }} />);
    const overlay = document.createElement('div');
    const state = renderHook(() => ar.useARState());
    expect(state.result.current).toBe('off');
    let msg: string | null = 'not run';
    await act(async () => {
      msg = await ar.enterAR(overlay);
    });
    expect(msg).toBeNull();
    expect(xr.requestSession).toHaveBeenCalledTimes(1);
    const [mode, init] = xr.requestSession.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ];
    expect(mode).toBe('immersive-ar');
    expect(init.requiredFeatures).toEqual(['hit-test']);
    // ADR-213 adds anchors (optional).
    // ADR-218 adds depth-sensing and light-estimation (optional).
    expect(init.optionalFeatures).toEqual([
      'dom-overlay',
      'anchors',
      'depth-sensing',
      'light-estimation',
    ]);
    expect(init.domOverlay).toEqual({ root: overlay });
    expect(gl.xr.enabled).toBe(true);
    expect(gl.xr.setSession).toHaveBeenCalledWith(session);
    expect(session.requestHitTestSource).toHaveBeenCalled();
    // Waiting for a tap on the floor; the scene is hidden until then and the camera picture shows through.
    expect(state.result.current).toBe('placing');
    expect(scene.background).toBeNull();
    await act(async () => ar.exitAR());
    expect(session.end).toHaveBeenCalled();
    expect(state.result.current).toBe('off');
    expect(scene.children.every((c) => c.visible)).toBe(true);
  });

  it('a session that cannot start gives a message, never an exception', async () => {
    const { xr } = stubXR(true);
    xr.requestSession.mockRejectedValueOnce(new Error('NotSupportedError'));
    three.state = {
      gl: { xr: { setReferenceSpaceType() {}, setSession: async () => {} } },
      scene: new Scene(),
    };
    const ar = await import('../src/viewer/AR');
    render(<ar.ARBridge bounds={{ x: 0, y: 0, z: 0, w: 1, h: 1, d: 1 }} />);
    let msg: string | null = null;
    await act(async () => {
      msg = await ar.enterAR(null);
    });
    expect(msg).toBe('AR could not start on this device.');
  });
});

describe('AR taps and hints (fix: nothing happened on taps)', () => {
  beforeEach(() => vi.resetModules());

  it('the overlay keeps only taps on its buttons; a tap anywhere else still reaches the session as select', async () => {
    const ar = await import('../src/viewer/AR');
    const overlay = document.createElement('div');
    const hint = overlay.appendChild(document.createElement('p'));
    const exit = overlay.appendChild(document.createElement('button'));
    const label = exit.appendChild(document.createElement('span'));
    overlay.addEventListener('beforexrselect', ar.keepTapsForButtons);
    const tap = (el: Element) => {
      const e = new Event('beforexrselect', { bubbles: true, cancelable: true });
      el.dispatchEvent(e);
      return e.defaultPrevented;
    };
    // The overlay covers the whole screen: a tap on it or its hint is a tap on the floor.
    expect(tap(overlay)).toBe(false);
    expect(tap(hint)).toBe(false);
    expect(tap(exit)).toBe(true);
    expect(tap(label)).toBe(true);
  });

  it('the hint follows the floor ring; a tap with no floor places nothing, a tap with the ring places', async () => {
    const selects = new Set<() => void>();
    const { session } = stubXR(true);
    const add = session.addEventListener;
    session.addEventListener = (type: string, f: () => void) =>
      type === 'select' ? selects.add(f) : add(type, f);
    const scene = new Scene();
    scene.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
    const ref = {};
    const gl = {
      xr: {
        enabled: false,
        setReferenceSpaceType: vi.fn(),
        setSession: vi.fn(async () => {}),
        getCamera: () => ({ position: new Vector3(0, 1.5, 2) }),
        getReferenceSpace: () => ref,
      },
    };
    three.state = { gl, scene };
    const ar = await import('../src/viewer/AR');
    render(<ar.ARBridge bounds={{ x: 0, y: 0, z: 0, w: 600, h: 870, d: 560 }} />);
    const st = renderHook(() => [ar.useARState(), ar.useARFloorFound()] as const);
    await act(async () => {
      await ar.enterAR(document.createElement('div'));
    });
    const floor = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.2, 0, -1, 1]);
    const frame = (hit: boolean) =>
      act(() =>
        three.frame!(null, 0, {
          getHitTestResults: () =>
            hit ? [{ getPose: () => ({ transform: { matrix: floor } }) }] : [],
        }),
      );
    // A tap is handled in the frame after it (hit results and anchors need an animation frame).
    const tap = (hit: boolean) => {
      act(() => selects.forEach((f) => f()));
      frame(hit);
    };
    const steadyFloor = () => {
      for (let n = 0; n < 6; n++) frame(true);
    };
    frame(false);
    expect(st.result.current).toEqual(['placing', false]);
    tap(false);
    expect(st.result.current[0]).toBe('placing');
    // The floor counts once it is steady for 6 frames (ADR-213).
    steadyFloor();
    expect(st.result.current).toEqual(['placing', true]);
    // The floor went away again (phone moved off the floor): the last spot is not used.
    tap(false);
    expect(st.result.current[0]).toBe('placing');
    steadyFloor();
    tap(true);
    expect(st.result.current[0]).toBe('placed');
    await act(async () => ar.exitAR());
    expect(st.result.current).toEqual(['off', false]);
  });
});

describe('Export for AR (.usdz) (ADR-208 item 7)', () => {
  it('builds a USDZ (a zip holding a .usda) of the pieces on this device, with no request; downloads <name>.usdz', async () => {
    vi.resetModules();
    const { setStage } = await import('../src/viewer/renderBridge');
    const { exportUsdz } = await import('../src/viewer/AR');
    const scene = new Scene();
    const box = new Mesh(
      new BoxGeometry(0.6, 0.87, 0.56),
      new MeshStandardMaterial({ color: '#c8a070' }),
    );
    box.position.set(0.3, 0.435, 0.28);
    scene.add(box);
    // A display-only room mesh (its own raycast) is left out.
    const wall = new Mesh(new BoxGeometry(3, 2.5, 0.1), new MeshStandardMaterial());
    wall.raycast = () => {};
    scene.add(wall);
    setStage({ scene, camera: new PerspectiveCamera() });

    const fetchSpy = vi.fn(() => Promise.reject(new Error('no network')));
    vi.stubGlobal('fetch', fetchSpy);
    const XHR = vi.fn();
    vi.stubGlobal('XMLHttpRequest', XHR);
    let blob: Blob | null = null;
    URL.createObjectURL = vi.fn((b: Blob) => {
      blob = b;
      return 'blob:usdz';
    }) as never;
    URL.revokeObjectURL = vi.fn();
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });
    // Not an iPhone: no AR Quick Look, so the file downloads.
    vi.spyOn(DOMTokenList.prototype, 'supports').mockReturnValue(false);

    expect(await exportUsdz('Kitchen: wall 1')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(XHR).not.toHaveBeenCalled();
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('Kitchen wall 1.usdz');
    expect(clicked[0].rel).toBe('');
    expect(blob!.type).toBe('model/vnd.usdz+zip');
    const bytes = new Uint8Array(await blob!.arrayBuffer());
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK');
    const files = unzipSync(bytes);
    const usda = Object.keys(files).filter((n) => n.endsWith('.usda'));
    expect(usda.length).toBeGreaterThan(0);
    expect(usda).toContain('model.usda');
    const text = new TextDecoder().decode(files['model.usda']);
    expect(text).toMatch(/^#usda/);
    // One geometry: the piece, not the room's wall.
    expect(usda.filter((n) => n.startsWith('geometries/'))).toHaveLength(1);
    setStage(null);
    vi.unstubAllGlobals();
  });

  it('on an iPhone (rel="ar" supported) the link opens AR Quick Look with a picture inside', async () => {
    vi.resetModules();
    const { setStage } = await import('../src/viewer/renderBridge');
    const { exportUsdz } = await import('../src/viewer/AR');
    const scene = new Scene();
    scene.add(new Mesh(new BoxGeometry(0.5, 0.5, 0.5), new MeshStandardMaterial()));
    setStage({ scene, camera: new PerspectiveCamera() });
    URL.createObjectURL = vi.fn(() => 'blob:usdz') as never;
    URL.revokeObjectURL = vi.fn();
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });
    vi.spyOn(DOMTokenList.prototype, 'supports').mockImplementation((t: string) => t === 'ar');
    expect(await exportUsdz('Sideboard')).toBeNull();
    expect(clicked[0].rel).toBe('ar');
    expect(clicked[0].download).toBe('');
    expect(clicked[0].href).toBe('blob:usdz');
    expect(clicked[0].querySelector('img')).not.toBeNull();
    setStage(null);
  });

  it('without an open 3D view it says so instead of throwing', async () => {
    vi.resetModules();
    const { exportUsdz } = await import('../src/viewer/AR');
    expect(await exportUsdz('x')).toBe('Open the 3D view first.');
  });
});

describe('render engine (ADR-208 item 8)', () => {
  it('WebGPU when navigator.gpu gives an adapter, otherwise WebGL 2; never throws', async () => {
    const { detectEngine } = await import('../src/shared/renderSupport');
    delete nav.gpu;
    expect(await detectEngine()).toBe('WebGL 2');
    setNav('gpu', { requestAdapter: async () => ({}) });
    expect(await detectEngine()).toBe('WebGPU');
    setNav('gpu', { requestAdapter: async () => null });
    expect(await detectEngine()).toBe('WebGL 2');
    setNav('gpu', {
      requestAdapter: async () => {
        throw new Error('blocked');
      },
    });
    expect(await detectEngine()).toBe('WebGL 2');
  });
});

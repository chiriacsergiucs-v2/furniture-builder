// @vitest-environment jsdom
// AR walls, wall gap, depth occlusion, light estimation, one-finger drag and per-piece sizes (ADR-217, N222), with
// WebXR simulated frame by frame: the centre ray, the two side rays, the touch source, depth and light estimates are
// stand-ins. The real-phone check is G-482.
import { act, cleanup, render, renderHook } from '@testing-library/react';
import {
  BoxGeometry,
  DirectionalLight,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Scene,
  Vector3,
  type DataTexture,
} from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dragTo,
  mainLight,
  nextARSizes,
  placeAt,
  toWorld,
  wallsCorner,
  withWallGap,
} from '../src/viewer/arPlace';

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

const B = { x: 0, y: 0, z: 0, w: 600, h: 870, d: 560 };
const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

describe('AR walls, gap, drag, light and sizes maths (ADR-217)', () => {
  it('two walls meeting square give the corner; the back goes against the wall the phone faces', () => {
    const left = { x: 0, z: -0.7, nx: 1, nz: 0 }; // the wall x = 0, facing +x
    const back = { x: 0.8, z: 0, nx: 0, nz: 1 }; // the wall z = 0, facing +z
    const c = wallsCorner(left, back, -1.2, { x: 0.5, z: 2 })!;
    expect(close(c.corner.x, 0) && close(c.corner.z, 0) && c.corner.y === -1.2).toBe(true);
    // Along the back wall (z = 0), away from the left wall: +x.
    expect(close(c.along.x, 1) && close(c.along.z, 0)).toBe(true);
    // Facing the left wall instead: its wall is the back, along it away from z = 0: +z.
    const c2 = wallsCorner(left, back, 0, { x: 2, z: 0.4 })!;
    expect(close(c2.along.x, 0) && close(c2.along.z, 1)).toBe(true);
    // Nearly parallel walls make no corner.
    expect(wallsCorner(back, { x: 0, z: 0.1, nx: 0.17, nz: 0.98 }, 0, { x: 0, z: 2 })).toBeNull();
  });

  it('the wall gap moves the back off its wall and the side off the side wall', () => {
    const pl = placeAt(B, 'back-left', { x: 0, y: 0, z: 0 }, 0);
    const g = toWorld(B, withWallGap(pl, 'back-left', 20), 0, 0, 0);
    expect(close(g.x, 0.02) && close(g.z, 0.02)).toBe(true);
    const pr = placeAt(B, 'back-right', { x: 0, y: 0, z: 0 }, 0);
    const gr = toWorld(B, withWallGap(pr, 'back-right', 20), 0.6, 0, 0);
    expect(close(gr.x, -0.02) && close(gr.z, 0.02)).toBe(true);
  });

  it('a drag moves the placement by the finger’s floor movement and keeps its turn', () => {
    const pl = placeAt(B, 'centre', { x: 0, y: 0, z: -1 }, 0.4);
    const d = dragTo(pl, { x: 0.1, y: 0, z: -1 }, { x: 0.35, y: 0.01, z: -0.8 });
    expect(close(d.cx - pl.cx, 0.25) && close(d.cz - pl.cz, 0.2)).toBe(true);
    expect(d.yaw).toBe(pl.yaw);
    expect(d.cy).toBe(pl.cy);
  });

  it('the main light: colour scaled to 0–1, intensity the scale, the estimate’s direction', () => {
    const m = mainLight({
      sphericalHarmonicsCoefficients: [],
      primaryLightDirection: { x: 0, y: 1, z: 0 },
      primaryLightIntensity: { x: 4, y: 2, z: 1 },
    });
    expect(m.color).toEqual([1, 0.5, 0.25]);
    expect(m.intensity).toBe(4);
    expect(m.direction).toEqual([0, 1, 0]);
  });

  it('Sizes cycles Overall → Per piece → Off', () => {
    expect(nextARSizes('overall')).toBe('piece');
    expect(nextARSizes('piece')).toBe('off');
    expect(nextARSizes('off')).toBe('overall');
  });
});

// ---------------------------------------------------------------------------
// The session, frame by frame
// ---------------------------------------------------------------------------

const floorAt = (x: number, y: number, z: number) =>
  new Float32Array(new Matrix4().makeTranslation(x, y, z).elements);
/** A wall hit: the pose's y axis (the surface normal) turned to point along (nx, 0, nz). */
const wallAt = (x: number, z: number, nx: number, nz: number) => {
  const up = new Vector3(nx, 0, nz).normalize();
  const m = new Matrix4().makeBasis(new Vector3(0, 1, 0).cross(up), up, new Vector3(0, 1, 0));
  return new Float32Array(m.setPosition(x, 0.4, z).elements);
};

interface Hits {
  centre: Float32Array | null;
  left: Float32Array | null;
  right: Float32Array | null;
  touch: Float32Array | null;
}

async function startAR(opts: { depth?: boolean; light?: boolean } = {}) {
  vi.resetModules();
  (globalThis as Record<string, unknown>).XRRay = class {
    constructor(
      public origin: DOMPointInit,
      public direction: DOMPointInit,
    ) {}
  };
  const listeners = new Map<string, Set<() => void>>();
  const fire = (type: string) => act(() => listeners.get(type)?.forEach((f) => f()));
  const features = [
    'hit-test',
    'anchors',
    ...(opts.depth ? ['depth-sensing'] : []),
    ...(opts.light ? ['light-estimation'] : []),
  ];
  const probe = { probe: true };
  const session = {
    enabledFeatures: features,
    depthUsage: opts.depth ? 'cpu-optimized' : undefined,
    depthDataFormat: 'luminance-alpha',
    end: vi.fn(async () => listeners.get('end')?.forEach((f) => f())),
    addEventListener: (type: string, f: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(f);
    },
    removeEventListener: (type: string, f: () => void) => listeners.get(type)?.delete(f),
    requestReferenceSpace: vi.fn(async () => ({})),
    requestHitTestSource: vi.fn(async (o: { offsetRay?: { direction: { x: number } } }) => ({
      ray: !o.offsetRay ? 'centre' : o.offsetRay.direction.x < 0 ? 'left' : 'right',
      cancel: () => {},
    })),
    requestHitTestSourceForTransientInput: vi.fn(async () => ({ ray: 'touch', cancel: () => {} })),
    requestLightProbe: opts.light ? vi.fn(async () => probe) : undefined,
  };
  Object.defineProperty(navigator, 'xr', {
    configurable: true,
    value: { isSessionSupported: async () => true, requestSession: vi.fn(async () => session) },
  });
  const scene = new Scene();
  const box = new Mesh(new BoxGeometry(0.6, 0.87, 0.56), new MeshStandardMaterial());
  const lamp = new DirectionalLight();
  scene.add(box, lamp);
  const ref = { ref: true };
  const cam = new Vector3(0.5, 1.4, 2);
  three.state = {
    gl: {
      xr: {
        enabled: false,
        setReferenceSpaceType: vi.fn(),
        setSession: vi.fn(async () => {}),
        getCamera: () => ({ position: cam }),
        getReferenceSpace: () => ref,
      },
      getDrawingBufferSize: (v: { set(x: number, y: number): void }) => v.set(1080, 2340),
    },
    scene,
  };
  const ar = await import('../src/viewer/AR');
  const pieces = [
    { box: { x: 0, y: 0, z: 0, w: 600, h: 870, d: 560 }, w: 600, h: 870, d: 560 },
    { box: { x: 600, y: 0, z: 0, w: 400, h: 720, d: 560 }, w: 400, h: 720, d: 560 },
  ];
  render(<ar.ARBridge bounds={{ x: 0, y: 0, z: 0, w: 1000, h: 870, d: 560 }} pieces={pieces} />);
  const ui = renderHook(() => ar.useARUi());
  await act(async () => {
    expect(await ar.enterAR(document.createElement('div'))).toBeNull();
  });
  const hits: Hits = { centre: null, left: null, right: null, touch: null };
  const result = (pose: Float32Array | null) =>
    pose
      ? [
          {
            getPose: (s: unknown) => (s === ref ? { transform: { matrix: pose } } : null),
            createAnchor: async () => ({ anchorSpace: {}, delete: () => {} }),
          },
        ]
      : [];
  const depth = {
    data: new Uint16Array(160 * 90).fill(1500).buffer,
    width: 160,
    height: 90,
    rawValueToMeters: 0.001,
    normDepthBufferFromNormView: { matrix: new Float32Array(new Matrix4().elements) },
  };
  const estimate = {
    sphericalHarmonicsCoefficients: new Float32Array(27).fill(0.2),
    primaryLightDirection: { x: 0.3, y: 0.9, z: 0.1 },
    primaryLightIntensity: { x: 3, y: 3, z: 2 },
  };
  const frame = () =>
    act(() =>
      three.frame!(null, 0, {
        getHitTestResults: (src: { ray: keyof Hits }) => result(hits[src.ray]),
        getHitTestResultsForTransientInput: () => [{ results: result(hits.touch) }],
        getViewerPose: () => ({
          views: [{ projectionMatrix: new Float32Array(new Matrix4().elements) }],
        }),
        getDepthInformation: opts.depth ? () => depth : undefined,
        getLightEstimate: opts.light ? (p: unknown) => (p === probe ? estimate : null) : undefined,
      }),
    );
  const frames = (n: number) => {
    for (let i = 0; i < n; i++) frame();
  };
  const tap = () => {
    fire('select');
    frame();
  };
  return { ar, ui, scene, box, lamp, hits, frame, frames, tap, fire, session };
}

afterEach(() => {
  cleanup();
  delete (navigator as unknown as Record<string, unknown>).xr;
});

describe('View in AR with walls and a wall gap (ADR-217)', () => {
  it('both walls seen: one tap puts the back-left corner in the room corner, off the walls by the gap', async () => {
    const { ar, ui, hits, frames, tap } = await startAR();
    hits.centre = floorAt(0.2, -1.3, 0.3);
    act(() => ar.startARCorner());
    frames(6);
    expect(ui.result.current.walls).toBe(false);
    hits.left = wallAt(0, 0.6, 1, 0);
    hits.right = wallAt(0.9, 0, 0, 1);
    frames(2);
    expect(ui.result.current.walls).toBe(true);
    act(() => ar.stepARWallGap(true));
    act(() => ar.stepARWallGap(true));
    expect(ui.result.current.gap).toBe(10);
    tap();
    expect(ui.result.current.state).toBe('placed');
    expect(ui.result.current.byCorner).toBe(true);
    const bounds = { x: 0, y: 0, z: 0, w: 1000, h: 870, d: 560 };
    const bl = toWorld(bounds, ar.currentPlacement()!, 0, 0, 0);
    expect(close(bl.x, 0.01) && close(bl.z, 0.01) && close(bl.y, -1.3)).toBe(true);
    // Changing the gap once placed moves it.
    act(() => ar.stepARWallGap(true));
    const bl2 = toWorld(bounds, ar.currentPlacement()!, 0, 0, 0);
    expect(close(bl2.x, 0.015) && close(bl2.z, 0.015)).toBe(true);
    // Never below 0 mm.
    for (let i = 0; i < 5; i++) act(() => ar.stepARWallGap(false));
    expect(ui.result.current.gap).toBe(0);
    await act(async () => ar.exitAR());
  });

  it('with one wall or none, Room corner keeps the two floor taps', async () => {
    const { ar, ui, hits, frames, tap } = await startAR();
    hits.centre = floorAt(0, -1.3, 0);
    hits.left = wallAt(0, 0.6, 1, 0);
    act(() => ar.startARCorner());
    frames(6);
    expect(ui.result.current.walls).toBe(false);
    tap();
    expect(ui.result.current.corner).toBe('second');
    await act(async () => ar.exitAR());
  });
});

describe('View in AR once placed: drag, occlusion, light, sizes (ADR-217)', () => {
  async function placed(opts: { depth?: boolean; light?: boolean } = {}) {
    const t = await startAR(opts);
    t.hits.centre = floorAt(0, -1.3, -1);
    t.frames(6);
    t.tap();
    expect(t.ui.result.current.state).toBe('placed');
    return t;
  }

  it('a one-finger drag moves it with the finger across the floor; letting go stops', async () => {
    const { ar, hits, frame, fire } = await placed();
    const p0 = ar.currentPlacement()!;
    fire('selectstart');
    expect(ar.arInternals().dragging).toBe(true);
    hits.touch = floorAt(0.1, -1.3, -1);
    frame();
    hits.touch = floorAt(0.4, -1.3, -0.8);
    frame();
    const p1 = ar.currentPlacement()!;
    expect(close(p1.cx - p0.cx, 0.3) && close(p1.cz - p0.cz, 0.2)).toBe(true);
    expect(p1.yaw).toBe(p0.yaw);
    fire('selectend');
    hits.touch = floorAt(2, -1.3, 2);
    frame();
    expect(ar.currentPlacement()).toEqual(p1);
    await act(async () => ar.exitAR());
  });

  it('with depth: the occluder gets each frame’s depth; the switch hides it', async () => {
    const { ar, ui, frame } = await placed({ depth: true });
    expect(ui.result.current.depth).toBe(true);
    frame();
    const occ = ar.arInternals().occluder!;
    expect(occ.visible).toBe(true);
    const tex = occ.material.uniforms.uDepth.value as DataTexture;
    expect([tex.image.width, tex.image.height]).toEqual([160, 90]);
    expect(occ.material.uniforms.uRawToMeters.value).toBe(0.001);
    act(() => ar.toggleAROcclusion());
    expect(ui.result.current.occlusion).toBe(false);
    expect(occ.visible).toBe(false);
    await act(async () => ar.exitAR());
  });

  it('without depth: no occluder and no switch', async () => {
    const { ar, ui, frame } = await placed();
    frame();
    expect(ui.result.current.depth).toBe(false);
    expect(ar.arInternals().occluder).toBeNull();
    await act(async () => ar.exitAR());
  });

  it('a light estimate replaces the view’s lights; Place again brings them back', async () => {
    const { ar, frame, lamp } = await placed({ light: true });
    await act(async () => {});
    frame();
    const light = ar.arInternals().estLight!;
    expect(light).not.toBeNull();
    const sun = light.children[1] as DirectionalLight;
    expect(sun.intensity).toBe(3);
    expect([sun.color.r, sun.color.g, sun.color.b].map((c) => +c.toFixed(3))).toEqual([
      1, 1, 0.667,
    ]);
    expect(lamp.visible).toBe(false);
    act(() => ar.placeARAgain());
    expect(ar.arInternals().estLight).toBeNull();
    await act(async () => ar.exitAR());
    expect(lamp.visible).toBe(true);
  });

  it('Sizes: overall W, H, D; per piece each piece’s W × H × D; off none', async () => {
    const { ar, ui } = await placed();
    const bounds = { x: 0, y: 0, z: 0, w: 1000, h: 870, d: 560 };
    const pieces = [
      { box: { x: 0, y: 0, z: 0, w: 600, h: 870, d: 560 }, w: 600, h: 870, d: 560 },
      { box: { x: 600, y: 0, z: 0, w: 400, h: 720, d: 560 }, w: 400, h: 720, d: 560 },
    ];
    expect(ui.result.current.sizes).toBe('overall');
    expect(ar.sizeLabels('overall', bounds, pieces).map((l) => l.text)).toEqual([
      'W 1000 mm',
      'H 870 mm',
      'D 560 mm',
    ]);
    act(() => ar.cycleARSizes());
    expect(ui.result.current.sizes).toBe('piece');
    expect(ar.sizeLabels('piece', bounds, pieces).map((l) => l.text)).toEqual([
      '600 × 870 × 560 mm',
      '400 × 720 × 560 mm',
    ]);
    act(() => ar.cycleARSizes());
    expect(ui.result.current.sizes).toBe('off');
    expect(ar.sizeLabels('off', bounds, pieces)).toEqual([]);
    await act(async () => ar.exitAR());
  });
});

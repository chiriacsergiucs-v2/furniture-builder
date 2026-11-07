// @vitest-environment jsdom
// AR grounding, corner placement, fine-tune and dimensions (ADR-213, ADR-214, ADR-215; N218 to N220), with WebXR
// simulated: hit-test results, anchors and taps are stand-ins driven frame by frame. The real-phone check is G-482.
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { BoxGeometry, Matrix4, Mesh, MeshStandardMaterial, Scene, Vector3 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cornerPlacement,
  dimensionLabels,
  isFloorPose,
  nextARPoint,
  NO_FLOOR,
  nudge,
  placeAt,
  pointLocal,
  shadowPixels,
  steady,
  toWorld,
  trackFloor,
  turnBy,
  type FloorTrack,
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
const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

describe('AR placement maths (ADR-213, ADR-214, ADR-215)', () => {
  it('only an up-facing hit is floor; a wall or a slope is not', () => {
    expect(isFloorPose(new Matrix4().elements)).toBe(true);
    expect(isFloorPose(new Matrix4().makeRotationX(Math.PI / 2).elements)).toBe(false); // a wall
    expect(isFloorPose(new Matrix4().makeRotationZ((25 * Math.PI) / 180).elements)).toBe(false);
    expect(isFloorPose(new Matrix4().makeRotationZ((10 * Math.PI) / 180).elements)).toBe(true);
  });

  it('the floor is steady after 6 frames within 3 cm; a jump or a missing frame starts again', () => {
    let t: FloorTrack = NO_FLOOR;
    for (let i = 0; i < 5; i++) t = trackFloor(t, 0.001 * i);
    expect(steady(t)).toBe(false);
    t = trackFloor(t, 0.006);
    expect(steady(t)).toBe(true);
    expect(steady(trackFloor(t, 0.1))).toBe(false);
    expect(steady(trackFloor(t, null))).toBe(false);
  });

  it('a 600 mm piece spans 0.6 m in AR, whatever its turn (1:1)', () => {
    for (const yaw of [0, 0.7, -2]) {
      const pl = placeAt(B, 'centre', { x: 1, y: -1.2, z: -2 }, yaw);
      const l = toWorld(B, pl, 0, 0, 0);
      const r = toWorld(B, pl, 0.6, 0, 0);
      expect(close(Math.hypot(r.x - l.x, r.z - l.z), 0.6)).toBe(true);
      expect(close(toWorld(B, pl, 0, 0.87, 0).y - l.y, 0.87)).toBe(true);
      expect(close(l.y, -1.2)).toBe(true); // its floor on the real floor
    }
  });

  it('the chosen point lands on the spot: centre, back-left, back-right', () => {
    expect(nextARPoint('centre')).toBe('back-left');
    expect(nextARPoint('back-left')).toBe('back-right');
    expect(nextARPoint('back-right')).toBe('centre');
    const spot = { x: 0.5, y: 0, z: -1 };
    for (const p of ['centre', 'back-left', 'back-right'] as const) {
      const pl = placeAt(B, p, spot, 0.9);
      const [x, z] = pointLocal(B, p);
      const w = toWorld(B, pl, x, 0, z);
      expect(close(w.x, spot.x) && close(w.z, spot.z)).toBe(true);
    }
  });

  it('room corner: the back runs along the tapped wall, the right corner in the room corner, either way', () => {
    const corner = { x: 0, y: 0, z: 0 };
    const cam = { x: 0.5, z: 1.5 }; // the phone stands in the room, in front of the wall along x
    // Wall to the right (+x): back-left in the corner, back along +x, front toward the phone.
    const right = cornerPlacement(B, corner, { x: 1.2, y: 0, z: 0 }, cam)!;
    expect(right.point).toBe('back-left');
    const bl = toWorld(B, right.placement, 0, 0, 0);
    const br = toWorld(B, right.placement, 0.6, 0, 0);
    const fl = toWorld(B, right.placement, 0, 0, 0.56);
    expect(close(bl.x, 0) && close(bl.z, 0)).toBe(true);
    expect(close(br.x, 0.6) && close(br.z, 0)).toBe(true);
    expect(fl.z > 0).toBe(true);
    // Wall to the left (-x): back-right in the corner, the piece runs along -x.
    const left = cornerPlacement(B, corner, { x: -1.2, y: 0, z: 0 }, cam)!;
    expect(left.point).toBe('back-right');
    const br2 = toWorld(B, left.placement, 0.6, 0, 0);
    const bl2 = toWorld(B, left.placement, 0, 0, 0);
    expect(close(br2.x, 0) && close(br2.z, 0)).toBe(true);
    expect(close(bl2.x, -0.6) && close(bl2.z, 0)).toBe(true);
    expect(toWorld(B, left.placement, 0, 0, 0.56).z > 0).toBe(true);
    // Taps under 5 cm apart give no direction.
    expect(cornerPlacement(B, corner, { x: 0.02, y: 0, z: 0 }, cam)).toBeNull();
  });

  it('fine-tune moves along the content’s own axes and turns about its centre', () => {
    const pl = placeAt(B, 'centre', { x: 0, y: 0, z: 0 }, Math.PI / 2);
    const moved = nudge(pl, 0.01, 0); // 1 cm to its right
    const a = toWorld(B, pl, 0, 0, 0),
      b = toWorld(B, moved, 0, 0, 0);
    expect(close(Math.hypot(b.x - a.x, b.z - a.z), 0.01)).toBe(true);
    const [rx, rz] = [Math.cos(Math.PI / 2), -Math.sin(Math.PI / 2)]; // its +x in the world
    expect(close((b.x - a.x) / 0.01, rx) && close((b.z - a.z) / 0.01, rz)).toBe(true);
    const turned = turnBy(pl, (-15 * Math.PI) / 180);
    expect(turned.cx).toBe(pl.cx);
    expect(turned.cz).toBe(pl.cz);
    expect(close(turned.yaw - pl.yaw, (-15 * Math.PI) / 180)).toBe(true);
  });

  it('labels: overall width, height and depth in mm', () => {
    const l = dimensionLabels({ x: 100, y: 0, z: 0, w: 1200, h: 2100, d: 600 });
    expect(l.map((x) => [x.key, x.mm])).toEqual([
      ['w', 1200],
      ['h', 2100],
      ['d', 600],
    ]);
  });

  it('the grounding shadow is darkest under the footprint and fades to nothing past it', () => {
    const n = 64;
    const px = shadowPixels(600, 560, n);
    const alpha = (i: number, j: number) => px[(j * n + i) * 4 + 3];
    expect(alpha(32, 32)).toBe(Math.round(0.5 * 255));
    expect(alpha(0, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The session, frame by frame
// ---------------------------------------------------------------------------

const floorAt = (x: number, y: number, z: number) =>
  new Float32Array(new Matrix4().makeTranslation(x, y, z).elements);
const wallAt = (x: number, y: number, z: number) =>
  new Float32Array(new Matrix4().makeRotationX(Math.PI / 2).setPosition(x, y, z).elements);

async function startAR() {
  vi.resetModules();
  const selects = new Set<() => void>();
  const ends = new Set<() => void>();
  const session = {
    end: vi.fn(async () => ends.forEach((f) => f())),
    addEventListener: (type: string, f: () => void) =>
      (type === 'select' ? selects : type === 'end' ? ends : new Set()).add(f),
    removeEventListener: () => {},
    requestReferenceSpace: vi.fn(async () => ({})),
    requestHitTestSource: vi.fn(async () => ({ cancel: () => {} })),
  };
  const xr = {
    isSessionSupported: vi.fn(async () => true),
    requestSession: vi.fn(async () => session),
  };
  Object.defineProperty(navigator, 'xr', { configurable: true, value: xr });
  const scene = new Scene();
  const box = new Mesh(new BoxGeometry(0.6, 0.87, 0.56), new MeshStandardMaterial());
  scene.add(box);
  const ref = { ref: true };
  const cam = new Vector3(0, 1.4, 1.5);
  three.state = {
    gl: {
      xr: {
        enabled: false,
        setReferenceSpaceType: vi.fn(),
        setSession: vi.fn(async () => {}),
        getCamera: () => ({ position: cam }),
        getReferenceSpace: () => ref,
      },
    },
    scene,
  };
  const ar = await import('../src/viewer/AR');
  render(<ar.ARBridge bounds={B} />);
  const ui = renderHook(() => ar.useARUi());
  await act(async () => {
    expect(await ar.enterAR(document.createElement('div'))).toBeNull();
  });
  const anchors: { anchorSpace: object; delete: () => void; at: Float32Array }[] = [];
  const createAnchor = vi.fn(function (this: { pose: Float32Array }) {
    const a = { anchorSpace: {}, delete: vi.fn(), at: this.pose };
    anchors.push(a);
    return Promise.resolve(a);
  });
  /** One AR frame with this hit (or none). */
  const frame = (pose: Float32Array | null) =>
    act(() =>
      three.frame!(null, 0, {
        getHitTestResults: () =>
          pose
            ? [
                {
                  pose,
                  getPose: (s: unknown) => (s === ref ? { transform: { matrix: pose } } : null),
                  createAnchor,
                },
              ]
            : [],
        trackedAnchors: new Set(anchors),
        getPose: (space: unknown) => {
          const a = anchors.find((x) => x.anchorSpace === space);
          return a ? { transform: { matrix: a.at } } : null;
        },
      }),
    );
  const steadyFloor = (x: number, z: number) => {
    for (let i = 0; i < 6; i++) frame(floorAt(x, 0, z));
  };
  const tap = (pose: Float32Array) => {
    act(() => selects.forEach((f) => f()));
    frame(pose); // the tap is handled in the next frame
  };
  return { ar, ui, scene, box, xr, session, anchors, createAnchor, frame, steadyFloor, tap, cam };
}

describe('View in AR, placing (ADR-213, ADR-214)', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    cleanup();
    delete (navigator as unknown as Record<string, unknown>).xr;
  });

  it('asks for anchors as an optional feature', async () => {
    const { xr, ar } = await startAR();
    const init = xr.requestSession.mock.calls[0] as unknown as [
      string,
      { optionalFeatures: string[] },
    ];
    expect(init[1].optionalFeatures).toEqual(['dom-overlay', 'anchors']);
    await act(async () => ar.exitAR());
  });

  it('a wall hit never shows the outline; it shows after 6 steady floor frames; jitter hides it again', async () => {
    const { ui, frame, ar } = await startAR();
    for (let i = 0; i < 10; i++) frame(wallAt(0, 0.5, -1));
    expect(ui.result.current.found).toBe(false);
    expect(ar.previewPlacement()).toBeNull();
    for (let i = 0; i < 5; i++) frame(floorAt(0, 0, -1));
    expect(ui.result.current.found).toBe(false);
    frame(floorAt(0, 0, -1));
    expect(ui.result.current.found).toBe(true);
    expect(ar.previewPlacement()).not.toBeNull();
    frame(floorAt(0, 0.08, -1)); // the height jumped 8 cm
    expect(ui.result.current.found).toBe(false);
    await act(async () => ar.exitAR());
  });

  it('a tap with no steady floor places nothing; with it, places on the spot with an anchor', async () => {
    const { ui, frame, steadyFloor, tap, ar, box, createAnchor } = await startAR();
    frame(null);
    tap(floorAt(0, 0, -1)); // only 1 floor frame: not steady
    expect(ui.result.current.state).toBe('placing');
    expect(box.visible).toBe(false);
    steadyFloor(0, -1);
    tap(floorAt(0, 0, -1));
    expect(ui.result.current.state).toBe('placed');
    expect(box.visible).toBe(true);
    expect(createAnchor).toHaveBeenCalledTimes(1);
    const pl = ar.currentPlacement()!;
    expect(close(pl.cx, 0, 1e-6) && close(pl.cz, -1, 1e-6)).toBe(true);
    await act(async () => ar.exitAR());
  });

  it('the content follows its anchor when the phone refines the floor (no drift)', async () => {
    const { steadyFloor, tap, frame, anchors, scene, ar } = await startAR();
    steadyFloor(0, -1);
    tap(floorAt(0, 0, -1));
    await act(async () => {}); // the anchor promise resolves
    expect(anchors).toHaveLength(1);
    const before = scene.matrix.elements[13];
    anchors[0].at = floorAt(0, -0.02, -1); // the floor turned out 2 cm lower
    frame(null);
    expect(close(scene.matrix.elements[13] - before, -0.02, 1e-6)).toBe(true);
    await act(async () => ar.exitAR());
  });

  it('the grounding shadow and the labels are in the scene only while placed', async () => {
    const { steadyFloor, tap, scene, ar } = await startAR();
    const has = (name: string) => scene.children.some((c) => c.name === name);
    expect(has('ar:shadow')).toBe(false);
    steadyFloor(0, -1);
    tap(floorAt(0, 0, -1));
    expect(has('ar:shadow')).toBe(true);
    act(() => ar.placeARAgain());
    expect(has('ar:shadow')).toBe(false);
    await act(async () => ar.exitAR());
    expect(has('ar:shadow')).toBe(false);
    expect(scene.children.some((c) => c.name === 'ar:preview')).toBe(false);
  });

  it('Point switch: the outline and the placement put the chosen point on the spot', async () => {
    const { ui, steadyFloor, tap, ar } = await startAR();
    act(() => ar.cycleARPoint());
    expect(ui.result.current.point).toBe('back-left');
    steadyFloor(0.3, -1);
    const shown = ar.previewPlacement()!;
    const bl = toWorld(B, shown, 0, 0, 0);
    expect(close(bl.x, 0.3, 1e-6) && close(bl.z, -1, 1e-6)).toBe(true);
    tap(floorAt(0.3, 0, -1));
    const placed = toWorld(B, ar.currentPlacement()!, 0, 0, 0);
    expect(close(placed.x, 0.3, 1e-6) && close(placed.z, -1, 1e-6)).toBe(true);
    await act(async () => ar.exitAR());
  });

  it('Room corner: two floor taps put the back along the wall with its corner in the room corner; Cancel corner', async () => {
    const { ui, steadyFloor, tap, ar } = await startAR();
    act(() => ar.startARCorner());
    expect(ui.result.current.corner).toBe('first');
    act(() => ar.cancelARCorner());
    expect(ui.result.current.corner).toBeNull();
    act(() => ar.startARCorner());
    steadyFloor(0, -1);
    tap(floorAt(0, 0, -1));
    expect(ui.result.current.corner).toBe('second');
    expect(ui.result.current.state).toBe('placing');
    // The phone stands at z = 1.5, so the wall along +x from the corner is "to the right": back-left in the corner.
    steadyFloor(1, -1);
    tap(floorAt(1, 0, -1));
    expect(ui.result.current.state).toBe('placed');
    const pl = ar.currentPlacement()!;
    const bl = toWorld(B, pl, 0, 0, 0),
      br = toWorld(B, pl, 0.6, 0, 0);
    expect(close(bl.x, 0, 1e-6) && close(bl.z, -1, 1e-6)).toBe(true);
    expect(close(br.x, 0.6, 1e-6) && close(br.z, -1, 1e-6)).toBe(true);
    await act(async () => ar.exitAR());
  });
});

describe('View in AR, fine-tune (ADR-215)', () => {
  afterEach(() => {
    cleanup();
    delete (navigator as unknown as Record<string, unknown>).xr;
  });

  it('moves 1 cm or 10 cm along its own axes, turns 1° or 15°, Place again returns to placing', async () => {
    const { ui, steadyFloor, tap, ar } = await startAR();
    steadyFloor(0, -1);
    tap(floorAt(0, 0, -1));
    const p0 = ar.currentPlacement()!;
    act(() => ar.nudgeAR('right'));
    let p = ar.currentPlacement()!;
    expect(close(Math.hypot(p.cx - p0.cx, p.cz - p0.cz), 0.01, 1e-9)).toBe(true);
    act(() => ar.toggleARStep());
    expect(ui.result.current.fine).toBe(false);
    act(() => ar.nudgeAR('left'));
    p = ar.currentPlacement()!;
    expect(close(Math.hypot(p.cx - p0.cx, p.cz - p0.cz), 0.09, 1e-9)).toBe(true);
    act(() => ar.turnARStep(true));
    expect(close(ar.currentPlacement()!.yaw - p0.yaw, (-15 * Math.PI) / 180)).toBe(true);
    act(() => ar.toggleARStep());
    act(() => ar.turnARStep(false));
    expect(close(ar.currentPlacement()!.yaw - p0.yaw, (-14 * Math.PI) / 180)).toBe(true);
    act(() => ar.placeARAgain());
    expect(ui.result.current.state).toBe('placing');
    expect(ar.currentPlacement()).toBeNull();
    await act(async () => ar.exitAR());
    expect(ui.result.current.state).toBe('off');
  });

  it('the labels read W, H and D in mm', async () => {
    const ar = await import('../src/viewer/AR');
    expect(ar.dimensionText('w', 600)).toBe('W 600 mm');
    expect(ar.dimensionText('h', 870)).toBe('H 870 mm');
    expect(ar.dimensionText('d', 560)).toBe('D 560 mm');
  });
});

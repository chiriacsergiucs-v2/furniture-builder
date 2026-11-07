import { invalidate, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useSyncExternalStore } from 'react';
import {
  CanvasTexture,
  CircleGeometry,
  DataTexture,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
  type Color,
  type Object3D,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { t } from '../core/i18n';
import type { Box } from '../core/types';
import {
  cornerPlacement,
  dimensionLabels,
  faceYaw,
  isFloorPose,
  nextARPoint,
  NO_FLOOR,
  nudge,
  placeAt,
  pointLocal,
  scenePosition,
  SHADOW_MARGIN,
  shadowPixels,
  SMOOTHING,
  steady,
  trackFloor,
  turnBy,
  type ARPoint,
  type FloorTrack,
  type Placement,
} from './arPlace';
import { getStage, SHADOW_CATCHER } from './renderBridge';
import { S } from './pieceDrag';

/**
 * AR (ADR-208, G-008): View in AR with three's own WebXR support (`renderer.xr`; no `@react-three/xr`, no controller
 * models, nothing from a CDN) and Export for AR (.usdz) with three's `USDZExporter`, loaded on demand. AR only shows
 * the scene: a tap on the floor puts the shown pieces and models there at 1:1, front to the phone; nothing is edited.
 * ADR-213: steady floor-only hits, anchors, a grounding shadow, native framebuffer scale. ADR-214: footprint outline,
 * point switch, two-tap room corner. ADR-215: fine-tune buttons and W × H × D labels. The maths is in `arPlace.ts`.
 */

/** Just the WebXR calls used here (the DOM library has no WebXR types). */
interface XRHitSource {
  cancel(): void;
}
interface XRSessionLike {
  end(): Promise<void>;
  addEventListener(type: string, f: () => void): void;
  removeEventListener(type: string, f: () => void): void;
  requestReferenceSpace(type: string): Promise<unknown>;
  requestHitTestSource?(o: { space: unknown }): Promise<XRHitSource> | undefined;
}
interface XRSystemLike {
  isSessionSupported(mode: string): Promise<boolean>;
  requestSession(mode: string, init: Record<string, unknown>): Promise<XRSessionLike>;
}
interface XRAnchorLike {
  anchorSpace: unknown;
  delete?(): void;
}
interface XRHitResultLike {
  getPose(space: unknown): { transform: { matrix: Float32Array } } | null;
  createAnchor?(): Promise<XRAnchorLike> | undefined;
}
interface XRFrameLike {
  getHitTestResults(s: XRHitSource): XRHitResultLike[];
  getPose?(space: unknown, base: unknown): { transform: { matrix: Float32Array } } | null;
  trackedAnchors?: { has(a: XRAnchorLike): boolean };
}

const xrSystem = (): XRSystemLike | undefined => (navigator as unknown as { xr?: XRSystemLike }).xr;

// ---------------------------------------------------------------------------
// State shared with the toolbar and the overlay
// ---------------------------------------------------------------------------

export type ARState = 'off' | 'placing' | 'placed';
/** What the overlay shows (ADR-213 to ADR-215). One object, replaced on every change (stable for React). */
export interface ARUi {
  state: ARState;
  /** While placing: a steady floor is under the outline. */
  found: boolean;
  /** Which point of the content the floor spot marks (ADR-214). */
  point: ARPoint;
  /** Room corner mode (ADR-214): waiting for the corner tap, then the wall tap. */
  corner: null | 'first' | 'second';
  /** Fine-tune step (ADR-215): 1 cm / 1° when true, 10 cm / 15° when false. */
  fine: boolean;
}
const OFF: ARUi = { state: 'off', found: false, point: 'centre', corner: null, fine: true };
let ui: ARUi = OFF;
let supported: boolean | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
function setUi(p: Partial<ARUi>) {
  if ((Object.keys(p) as (keyof ARUi)[]).every((k) => ui[k] === p[k])) return;
  ui = { ...ui, ...p };
  emit();
}
/** Where AR is: off, waiting for a tap on the floor, or placed. */
export const useARState = () => useSyncExternalStore(subscribe, () => ui.state);
/** While placing: whether a steady floor shows the outline, so the hint can say to look for the floor or to tap. */
export const useARFloorFound = () => useSyncExternalStore(subscribe, () => ui.found);
/** Everything the AR overlay shows. */
export const useARUi = () => useSyncExternalStore(subscribe, () => ui);

/**
 * The AR overlay's `beforexrselect` handler: a tap on one of its buttons (Turn, Exit) must not also place the
 * furniture, but every other tap must reach the session as `select`. The overlay covers the whole screen, so stopping
 * every `beforexrselect` it sees would swallow the taps on the floor too (the cause of "nothing happens on taps").
 */
export function keepTapsForButtons(e: Event) {
  const target = e.target as Element | null;
  if (target?.closest?.('button, a, input, select, summary')) e.preventDefault();
}

/** True once `navigator.xr.isSessionSupported('immersive-ar')` said so; asked once per page. */
export function useARSupported(): boolean {
  useEffect(() => {
    if (supported !== null) return;
    supported = false;
    const xr = xrSystem();
    if (!xr?.isSessionSupported) return;
    xr.isSessionSupported('immersive-ar')
      .then((ok) => {
        supported = !!ok;
        emit();
      })
      .catch(() => undefined);
  }, []);
  return useSyncExternalStore(subscribe, () => !!supported);
}

// ---------------------------------------------------------------------------
// The session
// ---------------------------------------------------------------------------

interface Live {
  gl: WebGLRenderer;
  scene: Scene;
  bounds: Box;
}
let live: Live | null = null;
let session: XRSessionLike | null = null;
let hitSource: XRHitSource | null = null;
let saved: { background: Color | Texture | null } | null = null;
/** Scene children hidden while placing (all but the outline), and room meshes hidden once placed. */
let hiddenTop: Object3D[] = [];
let hiddenRoom: Object3D[] = [];
/** The outline while placing (ADR-214) and the shadow and labels once placed (ADR-213, ADR-215). */
let preview: Preview | null = null;
let grounding: Mesh | null = null;
let labels: Group | null = null;
/** Floor tracking (ADR-213): steady frames, the smoothed spot and this frame's hit (for the anchor). */
let floor: FloorTrack = NO_FLOOR;
let spot: Vector3 | null = null;
let hitNow: XRHitResultLike | null = null;
let tapQueued = false;
/** Room corner mode: the corner spot and its anchor (made in the frame of the first tap). */
let cornerSpot: Vector3 | null = null;
let cornerAnchor: AnchorWait | null = null;
/** The placement and the anchor it follows (ADR-213): content matrix = anchor now × anchor at placing⁻¹ × placement. */
let placement: Placement | null = null;
let anchor: AnchorWait | null = null;
const anchorDelta = new Matrix4();
const m0 = new Matrix4();
const q = new Quaternion();
const UP = new Vector3(0, 1, 0);
const ONE = new Vector3(1, 1, 1);

/** An anchor being made: the hit pose it started from, and the anchor once the promise resolves. */
interface AnchorWait {
  start: Matrix4;
  anchor: XRAnchorLike | null;
  dropped: boolean;
}
function makeAnchor(hit: XRHitResultLike, pose: Float32Array): AnchorWait {
  const w: AnchorWait = { start: new Matrix4().fromArray(pose), anchor: null, dropped: false };
  try {
    const p = hit.createAnchor?.();
    p?.then((a) => {
      if (w.dropped) a.delete?.();
      else w.anchor = a;
    }).catch(() => undefined);
  } catch {
    // No anchors on this device: the placement stays where it was put.
  }
  return w;
}
function dropAnchor(w: AnchorWait | null) {
  if (!w) return;
  w.dropped = true;
  w.anchor?.delete?.();
  w.anchor = null;
}

/** Ours: never hidden with the scene, never counted as room. */
const ours = (o: Object3D) => o.name.startsWith('ar:');
/** Display-only room meshes, previews and shadows: never shown in AR or exported (their own `raycast` picks nothing). */
const displayOnly = (o: Object3D) => Object.hasOwn(o, 'raycast') || o.name === SHADOW_CATCHER;
const showAll = (list: Object3D[]) => list.forEach((o) => (o.visible = true));

function hideForPlacing(scene: Scene) {
  showAll(hiddenRoom);
  hiddenRoom = [];
  hiddenTop = [];
  for (const c of scene.children)
    if (!ours(c) && c.visible) {
      c.visible = false;
      hiddenTop.push(c);
    }
}

function showForPlaced(scene: Scene) {
  showAll(hiddenTop);
  hiddenTop = [];
  // The room's walls and floor stay hidden: the real room is there.
  hiddenRoom = [];
  scene.traverse((o) => {
    if (!ours(o) && o.visible && displayOnly(o) && (o as Mesh).isMesh) hiddenRoom.push(o);
  });
  hiddenRoom.forEach((o) => (o.visible = false));
}

function resetSceneMatrix(scene: Scene) {
  scene.matrixAutoUpdate = true;
  scene.position.set(0, 0, 0);
  scene.rotation.set(0, 0, 0);
  scene.updateMatrix();
  scene.matrixWorldNeedsUpdate = true;
}

/** Moves the scene so the content stands at the placement, carried by the anchor's movement since placing. */
function apply() {
  const l = live;
  if (!l || !placement) return;
  const [x, y, z] = scenePosition(l.bounds, placement);
  m0.compose(new Vector3(x, y, z), q.setFromAxisAngle(UP, placement.yaw), ONE);
  l.scene.matrixAutoUpdate = false;
  l.scene.matrix.multiplyMatrices(anchorDelta, m0);
  l.scene.matrix.decompose(l.scene.position, l.scene.quaternion, l.scene.scale);
  l.scene.matrixWorldNeedsUpdate = true;
}

function place(pl: Placement, a: AnchorWait | null) {
  const l = live;
  if (!l) return;
  placement = pl;
  dropAnchor(anchor);
  anchor = a;
  anchorDelta.identity();
  showForPlaced(l.scene);
  if (preview) preview.root.visible = false;
  grounding = groundingShadow(l.bounds);
  labels = dimensionSprites(l.bounds);
  l.scene.add(grounding);
  if (labels) l.scene.add(labels);
  apply();
  setUi({ state: 'placed', corner: null, found: false });
}

function removeGroundingAndLabels(scene: Scene) {
  for (const o of [grounding, labels]) {
    if (!o) continue;
    scene.remove(o);
    o.traverse((c) => {
      const m = c as Mesh;
      m.geometry?.dispose();
      const mat = m.material as (MeshBasicMaterial & SpriteMaterial) | undefined;
      mat?.map?.dispose();
      mat?.dispose?.();
    });
  }
  grounding = null;
  labels = null;
}

/** Handles a tap in the frame after it (hit results and anchors need an animation frame). */
function onTap(cam: Vector3) {
  const l = live;
  if (!l || !spot || !hitNow || ui.state !== 'placing') return;
  const pose = hitPose(hitNow);
  if (!pose) return;
  if (ui.corner === 'first') {
    cornerSpot = spot.clone();
    dropAnchor(cornerAnchor);
    cornerAnchor = makeAnchor(hitNow, pose);
    setUi({ corner: 'second' });
    return;
  }
  if (ui.corner === 'second' && cornerSpot) {
    const c = cornerPlacement(l.bounds, cornerSpot, spot, cam);
    if (!c) return;
    const a = cornerAnchor;
    cornerAnchor = null;
    place(c.placement, a);
    return;
  }
  place(placeAt(l.bounds, ui.point, spot, faceYaw(spot, cam)), makeAnchor(hitNow, pose));
}

let refSpace: unknown = null;
const hitPose = (h: XRHitResultLike) => h.getPose(refSpace)?.transform.matrix ?? null;

function onSelect() {
  if (ui.state === 'placing') tapQueued = true;
}

function restore() {
  const l = live;
  hitSource?.cancel();
  hitSource = null;
  dropAnchor(anchor);
  dropAnchor(cornerAnchor);
  anchor = cornerAnchor = null;
  if (l) {
    if (preview) l.scene.remove(preview.root);
    removeGroundingAndLabels(l.scene);
    showAll(hiddenTop);
    showAll(hiddenRoom);
    if (saved) l.scene.background = saved.background;
    resetSceneMatrix(l.scene);
  }
  preview?.dispose();
  preview = null;
  hiddenTop = hiddenRoom = [];
  saved = null;
  placement = null;
  spot = cornerSpot = null;
  hitNow = null;
  floor = NO_FLOOR;
  tapQueued = false;
  session = null;
  refSpace = null;
  ui = OFF;
  emit();
  invalidate();
}

/**
 * View in AR: an `immersive-ar` session with `hit-test` required and `dom-overlay` and `anchors` optional (`overlay`
 * holds the hints and buttons). Returns a message when it could not start; never throws.
 */
export async function enterAR(overlay: HTMLElement | null): Promise<string | null> {
  const l = live;
  const xr = xrSystem();
  if (!l || !xr) return t('AR is not available on this device.');
  try {
    const s = await xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay', 'anchors'],
      ...(overlay ? { domOverlay: { root: overlay } } : {}),
    });
    session = s;
    // Sharper edges (ADR-213): the phone's native framebuffer size when it says what that is.
    const layer = (
      globalThis as { XRWebGLLayer?: { getNativeFramebufferScaleFactor?(s: unknown): number } }
    ).XRWebGLLayer;
    const native = layer?.getNativeFramebufferScaleFactor?.(s);
    if (native && native > 0) l.gl.xr.setFramebufferScaleFactor?.(native);
    l.gl.xr.enabled = true;
    l.gl.xr.setReferenceSpaceType('local');
    await l.gl.xr.setSession(s as unknown as Parameters<typeof l.gl.xr.setSession>[0]);
    const viewer = await s.requestReferenceSpace('viewer');
    hitSource = (await s.requestHitTestSource?.({ space: viewer })) ?? null;
    preview = new Preview(l.bounds);
    l.scene.add(preview.root);
    saved = { background: l.scene.background };
    hideForPlacing(l.scene);
    // The camera picture shows through.
    l.scene.background = null;
    floor = NO_FLOOR;
    setUi({ ...OFF, state: 'placing' });
    s.addEventListener('select', onSelect);
    s.addEventListener('end', function ended() {
      s.removeEventListener('select', onSelect);
      s.removeEventListener('end', ended);
      restore();
    });
    return null;
  } catch {
    if (session) await session.end().catch(() => undefined);
    restore();
    return t('AR could not start on this device.');
  }
}

/** Point switch (ADR-214): Centre → Back-left → Back-right. */
export function cycleARPoint() {
  if (ui.state === 'placing') setUi({ point: nextARPoint(ui.point) });
}

/** Room corner (ADR-214): the next two floor taps are the corner, then a spot along the wall. */
export function startARCorner() {
  if (ui.state === 'placing') setUi({ corner: 'first' });
}

/** Cancel corner: back to normal placing. */
export function cancelARCorner() {
  dropAnchor(cornerAnchor);
  cornerAnchor = null;
  cornerSpot = null;
  if (ui.state === 'placing') setUi({ corner: null });
}

/** Turn 90° ↻ in AR: a quarter clockwise seen from above, about the content's centre. */
export function turnAR() {
  if (!placement || ui.state !== 'placed') return;
  placement = turnBy(placement, -Math.PI / 2);
  apply();
}

/** Fine-tune move (ADR-215): along the content's own width (x) or depth (z), by the step (1 or 10 cm). */
export function nudgeAR(dir: 'left' | 'right' | 'back' | 'forward') {
  if (!placement || ui.state !== 'placed') return;
  const step = ui.fine ? 0.01 : 0.1;
  const [dx, dz] =
    dir === 'left'
      ? [-step, 0]
      : dir === 'right'
        ? [step, 0]
        : dir === 'back'
          ? [0, -step]
          : [0, step];
  placement = nudge(placement, dx, dz);
  apply();
}

/** Fine-tune turn (ADR-215): 1° or 15° about the centre; `cw` is clockwise seen from above. */
export function turnARStep(cw: boolean) {
  if (!placement || ui.state !== 'placed') return;
  const a = ((ui.fine ? 1 : 15) * Math.PI) / 180;
  placement = turnBy(placement, cw ? -a : a);
  apply();
}

/** Step switch: 1 cm / 1° ↔ 10 cm / 15°. */
export function toggleARStep() {
  setUi({ fine: !ui.fine });
}

/** Place again: back to placing, with the same point; the content hides until the next tap. */
export function placeARAgain() {
  const l = live;
  if (!l || ui.state !== 'placed') return;
  dropAnchor(anchor);
  anchor = null;
  placement = null;
  removeGroundingAndLabels(l.scene);
  resetSceneMatrix(l.scene);
  hideForPlacing(l.scene);
  if (preview) preview.root.visible = true;
  floor = NO_FLOOR;
  spot = null;
  setUi({ state: 'placing', found: false, corner: null });
}

/** Exit AR: ends the session; the view comes back as it was. */
export function exitAR() {
  if (session) void session.end().catch(() => restore());
  else restore();
}

/**
 * Inside the canvas: hands the renderer and scene to AR and, each AR frame, finds the steady floor, moves the outline,
 * handles a queued tap and follows the anchor. `bounds` is what is shown (mm).
 */
export function ARBridge({ bounds }: { bounds: Box }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    live = { gl, scene, bounds };
  }, [gl, scene, bounds]);
  useEffect(
    () => () => {
      if (session) exitAR();
      live = null;
    },
    [],
  );
  useFrame((_s, _d, frame) => {
    const f = frame as XRFrameLike | undefined;
    if (!f || ui.state === 'off' || !live) return;
    refSpace = gl.xr.getReferenceSpace();
    const cam = gl.xr.getCamera().position;
    if (ui.state === 'placed') {
      const a = anchor?.anchor;
      if (a && refSpace && (!f.trackedAnchors || f.trackedAnchors.has(a))) {
        const p = f.getPose?.(a.anchorSpace, refSpace);
        if (p) {
          anchorDelta
            .fromArray(p.transform.matrix)
            .multiply(new Matrix4().copy(anchor!.start).invert());
          apply();
        }
      }
      return;
    }
    // Placing: only the nearest hit counts, and only when it faces up (ADR-213).
    const hit = hitSource && refSpace ? f.getHitTestResults(hitSource)[0] : undefined;
    const m = hit ? hitPose(hit) : null;
    const isFloor = !!m && isFloorPose(m);
    floor = trackFloor(floor, isFloor ? m![13] : null);
    if (isFloor && steady(floor)) {
      const at = new Vector3(m![12], m![13], m![14]);
      spot = spot ? spot.lerp(at, SMOOTHING) : at;
      hitNow = hit!;
    } else {
      spot = null;
      hitNow = null;
    }
    setUi({ found: !!spot });
    preview?.update(live.bounds, spot, cam);
    if (tapQueued) {
      tapQueued = false;
      onTap(cam);
      preview?.update(live.bounds, spot, cam);
    }
  });
  return null;
}

// ---------------------------------------------------------------------------
// The outline while placing (ADR-214)
// ---------------------------------------------------------------------------

const WHITE = () =>
  new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false });

/** A flat strip on the floor from (x1, z1) to (x2, z2), `w` metres wide. */
function strip(x1: number, z1: number, x2: number, z2: number, w: number) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const mesh = new Mesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), WHITE());
  mesh.scale.set(len, 1, w);
  mesh.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
  mesh.rotation.y = Math.atan2(-(z2 - z1), x2 - x1);
  return mesh;
}

/**
 * The footprint outline: the content's width × depth with corner marks and a thicker front edge, a dot on the chosen
 * point; in room corner mode a ring on the spot, then a dot in the corner and a line along the wall.
 */
class Preview {
  root = new Group();
  footprint = new Group();
  dot = new Mesh(new CircleGeometry(0.03, 24).rotateX(-Math.PI / 2), WHITE());
  ring = new Mesh(new RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2), WHITE());
  cornerDot = new Mesh(new CircleGeometry(0.035, 24).rotateX(-Math.PI / 2), WHITE());
  wall = strip(0, 0, 1, 0, 0.015);
  private built = '';
  /** The last placement the outline showed (tests read it). */
  shown: Placement | null = null;

  constructor(b: Box) {
    this.root.name = 'ar:preview';
    this.root.add(this.footprint, this.ring, this.cornerDot, this.wall);
    this.footprint.add(this.dot);
    this.build(b);
    this.root.visible = true;
    this.hideAll();
  }

  private hideAll() {
    this.footprint.visible = this.ring.visible = this.cornerDot.visible = this.wall.visible = false;
  }

  /** Builds the footprint around the content's floor centre (metres). */
  private build(b: Box) {
    const key = `${b.w}×${b.d}`;
    if (key === this.built) return;
    this.built = key;
    for (const c of [...this.footprint.children]) if (c !== this.dot) this.footprint.remove(c);
    const w = b.w * S,
      d = b.d * S;
    const x0 = -w / 2,
      x1 = w / 2,
      z0 = -d / 2,
      z1 = d / 2;
    const line = 0.008,
      mark = Math.min(0.1, w / 3, d / 3),
      thick = 0.02;
    this.footprint.add(
      strip(x0, z0, x1, z0, line),
      strip(x1, z0, x1, z1, line),
      strip(x0, z0, x0, z1, line),
      // The front edge is thicker, so it is clear which way the furniture faces.
      strip(x0, z1, x1, z1, 0.025),
    );
    for (const [cx, cz, sx, sz] of [
      [x0, z0, 1, 1],
      [x1, z0, -1, 1],
      [x0, z1, 1, -1],
      [x1, z1, -1, -1],
    ])
      this.footprint.add(
        strip(cx, cz, cx + sx * mark, cz, thick),
        strip(cx, cz, cx, cz + sz * mark, thick),
      );
  }

  update(b: Box, at: Vector3 | null, cam: Vector3) {
    this.build(b);
    this.hideAll();
    this.shown = null;
    if (!at) return;
    const y = 0.002;
    if (ui.corner === 'first') {
      this.ring.position.set(at.x, at.y + y, at.z);
      this.ring.visible = true;
      return;
    }
    let pl: Placement | null = null;
    if (ui.corner === 'second' && cornerSpot) {
      this.cornerDot.position.set(cornerSpot.x, cornerSpot.y + y, cornerSpot.z);
      this.cornerDot.visible = true;
      const dx = at.x - cornerSpot.x,
        dz = at.z - cornerSpot.z;
      this.wall.position.set(
        (at.x + cornerSpot.x) / 2,
        cornerSpot.y + y,
        (at.z + cornerSpot.z) / 2,
      );
      this.wall.scale.x = Math.hypot(dx, dz);
      this.wall.rotation.y = Math.atan2(-dz, dx);
      this.wall.visible = true;
      pl = cornerPlacement(b, cornerSpot, at, cam)?.placement ?? null;
      this.dot.visible = false;
    } else {
      pl = placeAt(b, ui.point, at, faceYaw(at, cam));
      const [px, pz] = pointLocal(b, ui.point);
      const [cx, cz] = pointLocal(b, 'centre');
      this.dot.position.set(px - cx, 0.001, pz - cz);
      this.dot.visible = true;
    }
    if (!pl) return;
    this.footprint.position.set(pl.cx, pl.cy + y, pl.cz);
    this.footprint.rotation.y = pl.yaw;
    this.footprint.visible = true;
    this.shown = pl;
  }

  dispose() {
    this.root.traverse((o) => {
      const m = o as Mesh;
      m.geometry?.dispose();
      (m.material as MeshBasicMaterial | undefined)?.dispose?.();
    });
  }
}

/** For tests: the placement the outline shows now, or null. */
export const previewPlacement = () => preview?.shown ?? null;
/** For tests: the content's placement once placed, or null. */
export const currentPlacement = () => placement;

// ---------------------------------------------------------------------------
// Grounding shadow (ADR-213) and dimension labels (ADR-215)
// ---------------------------------------------------------------------------

/** A soft shadow on the floor under the footprint, in the content's own frame (it moves with the scene). */
function groundingShadow(b: Box): Mesh {
  const n = 64;
  const tex = new DataTexture(shadowPixels(b.w, b.d, n), n, n);
  tex.needsUpdate = true;
  const mesh = new Mesh(
    new PlaneGeometry((b.w + 2 * SHADOW_MARGIN) * S, (b.d + 2 * SHADOW_MARGIN) * S).rotateX(
      -Math.PI / 2,
    ),
    new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  mesh.name = 'ar:shadow';
  mesh.position.set((b.x + b.w / 2) * S, b.y * S + 0.001, (b.z + b.d / 2) * S);
  mesh.renderOrder = -1;
  mesh.raycast = () => undefined;
  return mesh;
}

/** The label text: W, H or D and the size in mm. */
export const dimensionText = (key: 'w' | 'h' | 'd', mm: number) =>
  key === 'w'
    ? t('W {mm} mm', { mm })
    : key === 'h'
      ? t('H {mm} mm', { mm })
      : t('D {mm} mm', { mm });

/** The W × H × D labels as sprites facing the phone; null where the device cannot draw text into a canvas. */
function dimensionSprites(b: Box): Group | null {
  const g = new Group();
  g.name = 'ar:labels';
  for (const l of dimensionLabels(b)) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx =
        typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)
          ? null
          : canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return null;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.roundRect(0, 0, 256, 64, 18);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dimensionText(l.key, l.mm), 128, 33);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    const sprite = new Sprite(
      new SpriteMaterial({ map: tex, depthTest: false, transparent: true }),
    );
    sprite.scale.set(0.2, 0.05, 1);
    sprite.position.set(...l.at);
    sprite.renderOrder = 10;
    sprite.raycast = () => undefined;
    g.add(sprite);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Export for AR (.usdz)
// ---------------------------------------------------------------------------

/** A file name from the design or project name, with characters file systems refuse replaced. */
const fileName = (name: string) =>
  `${
    Array.from(name, (ch) => (ch < ' ' || '\\/:*?"<>|'.includes(ch) ? ' ' : ch))
      .join('')
      .replace(/\s+/g, ' ')
      .trim() || 'Furniture'
  }.usdz`;

/**
 * Export for AR (.usdz): the shown pieces and models (not the room) as a USDZ file made on this device with three's
 * `USDZExporter`. On an iPhone (`rel="ar"` supported) AR Quick Look opens it; elsewhere it downloads. No request.
 * Returns a message when it fails; never throws.
 */
export async function exportUsdz(name: string): Promise<string | null> {
  const stage = getStage();
  if (!stage) return t('Open the 3D view first.');
  try {
    const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');
    const out = new Scene();
    stage.scene.updateMatrixWorld(true);
    stage.scene.traverseVisible((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh || displayOnly(o) || Array.isArray(mesh.material)) return;
      if (!(mesh.material as { isMeshStandardMaterial?: boolean }).isMeshStandardMaterial) return;
      const copy = new Mesh(mesh.geometry, mesh.material);
      copy.applyMatrix4(mesh.matrixWorld);
      out.add(copy);
    });
    const bytes = await new USDZExporter().parseAsync(out, { quickLookCompatible: true });
    const url = URL.createObjectURL(new Blob([bytes], { type: 'model/vnd.usdz+zip' }));
    const a = document.createElement('a');
    a.href = url;
    if (a.relList?.supports?.('ar')) {
      a.rel = 'ar';
      // AR Quick Look needs a picture inside the link.
      a.appendChild(document.createElement('img'));
    } else a.download = fileName(name);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return null;
  } catch (e) {
    return t('Could not export for AR: {message}', {
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

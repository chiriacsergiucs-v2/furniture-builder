import { invalidate, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useSyncExternalStore } from 'react';
import {
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Scene,
  Vector3,
  type Color,
  type Object3D,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { t } from '../core/i18n';
import type { Box } from '../core/types';
import { getStage, SHADOW_CATCHER } from './renderBridge';
import { S } from './pieceDrag';

/**
 * AR (ADR-208, G-008): View in AR with three's own WebXR support (`renderer.xr`; no `@react-three/xr`, no controller
 * models, nothing from a CDN) and Export for AR (.usdz) with three's `USDZExporter`, loaded on demand. AR only shows
 * the scene: a tap on the floor puts the shown pieces and models there at 1:1, front to the phone; nothing is edited.
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
interface XRFrameLike {
  getHitTestResults(
    s: XRHitSource,
  ): { getPose(space: unknown): { transform: { matrix: Float32Array } } | null }[];
}

const xrSystem = (): XRSystemLike | undefined => (navigator as unknown as { xr?: XRSystemLike }).xr;

// ---------------------------------------------------------------------------
// State shared with the toolbar and the overlay
// ---------------------------------------------------------------------------

export type ARState = 'off' | 'placing' | 'placed';
let state: ARState = 'off';
let supported: boolean | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
function setState(s: ARState) {
  state = s;
  emit();
}
/** Where AR is: off, waiting for a tap on the floor, or placed. */
export const useARState = () => useSyncExternalStore(subscribe, () => state);

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
let reticle: Mesh | null = null;
let lastHit: Vector3 | null = null;
let turn = 0;
let facing = 0;
let saved: { background: Color | Texture | null; hidden: Object3D[] } | null = null;

/** Display-only room meshes, previews and shadows: never shown in AR or exported (their own `raycast` picks nothing). */
const displayOnly = (o: Object3D) => Object.hasOwn(o, 'raycast') || o.name === SHADOW_CATCHER;

function hideAll(scene: Scene) {
  const hidden: Object3D[] = [];
  for (const c of scene.children)
    if (c !== reticle && c.visible) {
      c.visible = false;
      hidden.push(c);
    }
  return hidden;
}

/** The scene moved so the content's floor centre sits on the hit, turned to face the phone plus the user's turns. */
function place(l: Live) {
  if (!lastHit) return;
  const b = l.bounds;
  const cx = (b.x + b.w / 2) * S,
    cy = b.y * S,
    cz = (b.z + b.d / 2) * S;
  const a = facing + turn;
  const c = Math.cos(a),
    s = Math.sin(a);
  l.scene.rotation.set(0, a, 0);
  l.scene.position.set(
    lastHit.x - (cx * c + cz * s),
    lastHit.y - cy,
    lastHit.z - (-cx * s + cz * c),
  );
}

function onSelect() {
  const l = live;
  if (!l || !lastHit || state === 'off') return;
  if (state === 'placing') {
    // Front to the phone: the content's +z turns toward where the phone is now.
    const cam = l.gl.xr.getCamera().position;
    facing = Math.atan2(cam.x - lastHit.x, cam.z - lastHit.z);
    turn = 0;
    for (const o of saved?.hidden ?? []) o.visible = true;
    // The room's walls and floor stay hidden: the real room is there.
    const room: Object3D[] = [];
    l.scene.traverse((o) => {
      if (o !== reticle && o.visible && displayOnly(o) && (o as Mesh).isMesh) room.push(o);
    });
    room.forEach((o) => (o.visible = false));
    if (saved) saved.hidden = room;
    if (reticle) reticle.visible = false;
    place(l);
    setState('placed');
  }
}

function restore() {
  const l = live;
  hitSource?.cancel();
  hitSource = null;
  if (l) {
    if (reticle) l.scene.remove(reticle);
    for (const o of saved?.hidden ?? []) o.visible = true;
    if (saved) l.scene.background = saved.background;
    l.scene.position.set(0, 0, 0);
    l.scene.rotation.set(0, 0, 0);
  }
  saved = null;
  lastHit = null;
  session = null;
  setState('off');
  invalidate();
}

/**
 * View in AR: an `immersive-ar` session with `hit-test` required and `dom-overlay` optional (`overlay` holds Turn
 * and Exit). Returns a message when it could not start; never throws.
 */
export async function enterAR(overlay: HTMLElement | null): Promise<string | null> {
  const l = live;
  const xr = xrSystem();
  if (!l || !xr) return t('AR is not available on this device.');
  try {
    const s = await xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay'],
      ...(overlay ? { domOverlay: { root: overlay } } : {}),
    });
    session = s;
    l.gl.xr.enabled = true;
    l.gl.xr.setReferenceSpaceType('local');
    await l.gl.xr.setSession(s as unknown as Parameters<typeof l.gl.xr.setSession>[0]);
    const viewer = await s.requestReferenceSpace('viewer');
    hitSource = (await s.requestHitTestSource?.({ space: viewer })) ?? null;
    if (!reticle) {
      reticle = new Mesh(
        new RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
        new MeshBasicMaterial({ color: '#ffffff' }),
      );
      reticle.matrixAutoUpdate = false;
    }
    reticle.visible = false;
    l.scene.add(reticle);
    saved = { background: l.scene.background, hidden: hideAll(l.scene) };
    // The camera picture shows through.
    l.scene.background = null;
    setState('placing');
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

/** Turn 90° ↻ in AR: a quarter clockwise seen from above, about the content's centre. */
export function turnAR() {
  if (!live || state !== 'placed') return;
  turn -= Math.PI / 2;
  place(live);
}

/** Exit AR: ends the session; the view comes back as it was. */
export function exitAR() {
  if (session) void session.end().catch(() => restore());
  else restore();
}

/**
 * Inside the canvas: hands the renderer and scene to AR and moves the floor ring to the hit-test result each AR frame.
 * `bounds` is what is shown (mm).
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
  const m = new Matrix4();
  useFrame((_s, _d, frame) => {
    const f = frame as XRFrameLike | undefined;
    if (!f || !hitSource || state !== 'placing' || !reticle) return;
    const ref = gl.xr.getReferenceSpace();
    const hit = f.getHitTestResults(hitSource)[0];
    const pose = hit && ref ? hit.getPose(ref) : null;
    if (!pose) {
      reticle.visible = false;
      return;
    }
    m.fromArray(pose.transform.matrix);
    reticle.matrix.copy(m);
    reticle.visible = true;
    lastHit = new Vector3().setFromMatrixPosition(m);
  });
  return null;
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

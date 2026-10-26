import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Raycaster, Vector2 } from 'three';
import { floorDrop, floorPoint, type FloorPoint } from '../core/drag3d';
import type { SnapResult } from '../core/snap';
import { useDesign } from '../store/designStore';
import { DRAG_THRESHOLD_PX } from '../ui/planDrag';

/** mm → metres: the 3D scene's scale, shared with Viewer3D so pointer and boards agree. */
export const S = 0.001;

/** What the 3D view shows while a piece is dragged (ADR-093): the piece and where it would land. */
export interface PieceGhost {
  id: string;
  target: SnapResult;
  /** Snapping was asked for (Snap on, Alt not held), to say why nothing snapped. */
  snapping: boolean;
}

// The ghost lives outside React state so a pointer move re-renders only the ghost and its note, not the scene.
let ghostNow: PieceGhost | null = null;
const ghostListeners = new Set<() => void>();
function setGhost(g: PieceGhost | null) {
  if (g === ghostNow) return;
  ghostNow = g;
  ghostListeners.forEach((f) => f());
}
const subscribeGhost = (l: () => void) => {
  ghostListeners.add(l);
  return () => ghostListeners.delete(l);
};
/** The piece being dragged in 3D and where it would land, or null. */
export const useGhost = () => useSyncExternalStore(subscribeGhost, () => ghostNow);

// The Move button stays on until tapped off (ADR-093), also while the 3D view is hidden and shown again; this page
// only, never saved.
let moveNow = false;
const moveListeners = new Set<() => void>();
const subscribeMove = (l: () => void) => {
  moveListeners.add(l);
  return () => moveListeners.delete(l);
};
function setMove(on: boolean) {
  moveNow = on;
  moveListeners.forEach((f) => f());
}
/** Move mode on, and the switch for it. */
export function useMoveMode(): [boolean, (on: boolean) => void] {
  return [useSyncExternalStore(subscribeMove, () => moveNow), setMove];
}

interface Gesture {
  id: string;
  pointerId: number;
  sx: number;
  sy: number;
  /** The piece's base height (mm): the floor plane the pointer is projected onto. */
  y: number;
  from: FloorPoint;
  to: FloorPoint;
  dragging: boolean;
  alt: boolean;
}

/**
 * Moving project pieces in the 3D view (ADR-093). While `enabled` (the Move button), pressing a piece selects it
 * and dragging moves it across its floor plane; the camera does not orbit during a piece drag. The pointer is only
 * turned into a room point here; the drop is the Plan's (`floorDrop`, `dropItemAt`). Esc, a second finger or a
 * cancelled pointer drop the drag without moving anything. Returns the press handler for a piece's meshes and
 * `clicked()`, which says whether a click that follows a press should be ignored (it ended a drag or only selected).
 */
export function usePieceDrag(enabled: boolean, snapOn: boolean) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  /** Pause or resume the camera's orbit (OrbitControls) while a piece is dragged. */
  const orbit = useCallback(
    (on: boolean) => {
      const c = get().controls as { enabled: boolean } | null;
      if (c) c.enabled = on;
    },
    [get],
  );
  const raycaster = useMemo(() => new Raycaster(), []);
  const ndc = useMemo(() => new Vector2(), []);
  const gesture = useRef<Gesture | null>(null);
  const swallow = useRef(false);
  const cleanup = useRef<(() => void) | null>(null);
  // The latest values for the window listeners of a gesture in progress.
  const live = useRef({ snapOn, onGhost: setGhost });
  useEffect(() => {
    live.current = { snapOn, onGhost: setGhost };
  }, [snapOn]);

  /** Screen point → room point on the horizontal plane at height `y` (mm), or null off the floor. */
  const toFloor = useCallback(
    (clientX: number, clientY: number, y: number): FloorPoint | null => {
      const r = gl.domElement.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const { origin: o, direction: d } = raycaster.ray;
      return floorPoint({ origin: [o.x / S, o.y / S, o.z / S], dir: [d.x, d.y, d.z] }, y);
    },
    [gl, camera, raycaster, ndc],
  );

  const end = useCallback(() => {
    cleanup.current?.();
    cleanup.current = null;
    gesture.current = null;
    live.current.onGhost(null);
    orbit(true);
  }, [orbit]);

  // Leaving move mode or unmounting ends a drag in progress.
  useEffect(() => {
    if (!enabled) end();
    return () => {
      if (gesture.current) end();
    };
  }, [enabled, end]);

  const ghostOf = (g: Gesture): PieceGhost | null => {
    const st = useDesign.getState();
    const pieces = st.projectModel?.pieces;
    if (!st.project || !pieces) return null;
    const snapping = live.current.snapOn && !g.alt;
    const target = floorDrop(st.project, pieces, g.id, g.from, g.to, snapping);
    return target ? { id: g.id, target, snapping } : null;
  };

  const press = useCallback(
    (e: ThreeEvent<PointerEvent>, id: string) => {
      swallow.current = false;
      if (!enabled) return;
      const ne = e.nativeEvent;
      if (ne.pointerType === 'mouse' && ne.button !== 0) return;
      // A second pointer while a piece is pressed: the window listener cancels the drag.
      if (gesture.current) return;
      const st = useDesign.getState();
      const pc = st.projectModel?.pieces.find((p) => p.item.id === id);
      // A run part (worktop, trim) is not a piece: the press stops here, so the piece under it is not dragged.
      if (!pc) {
        e.stopPropagation();
        return;
      }
      const from = toFloor(ne.clientX, ne.clientY, pc.bounds.y);
      if (!from) return;
      e.stopPropagation();
      // Pressing a piece selects it; the click that follows must not also open it (ADR-083).
      if (st.selectedItemId !== id) {
        st.selectItem(id);
        swallow.current = true;
      }
      orbit(false);
      gesture.current = {
        id,
        pointerId: ne.pointerId,
        sx: ne.clientX,
        sy: ne.clientY,
        y: pc.bounds.y,
        from,
        to: from,
        dragging: false,
        alt: ne.altKey,
      };
      const onMove = (ev: PointerEvent) => {
        const g = gesture.current;
        if (!g || ev.pointerId !== g.pointerId) return;
        const dragging =
          g.dragging || Math.hypot(ev.clientX - g.sx, ev.clientY - g.sy) > DRAG_THRESHOLD_PX;
        // Off the floor (towards the horizon): keep the last valid point.
        const to = toFloor(ev.clientX, ev.clientY, g.y) ?? g.to;
        const next = { ...g, dragging, to: dragging ? to : g.from, alt: ev.altKey };
        gesture.current = next;
        if (dragging) live.current.onGhost(ghostOf(next));
      };
      const onUp = (ev: PointerEvent) => {
        const g = gesture.current;
        if (!g || ev.pointerId !== g.pointerId) return;
        end();
        if (!g.dragging) return;
        swallow.current = true;
        const snapping = live.current.snapOn && !ev.altKey;
        useDesign.getState().dropItemAt(g.id, g.from, g.to, snapping);
      };
      const onCancel = (ev: PointerEvent) => {
        const g = gesture.current;
        if (g && ev.pointerId === g.pointerId) {
          swallow.current = true;
          end();
        }
      };
      // A second finger (or any other pointer) cancels; the camera stays put until the first finger lifts.
      const onOther = (ev: PointerEvent) => {
        const g = gesture.current;
        if (!g || ev.pointerId === g.pointerId) return;
        swallow.current = true;
        end();
        orbit(false);
        const resume = (up: PointerEvent) => {
          if (up.pointerId !== g.pointerId) return;
          window.removeEventListener('pointerup', resume);
          window.removeEventListener('pointercancel', resume);
          orbit(true);
        };
        window.addEventListener('pointerup', resume);
        window.addEventListener('pointercancel', resume);
      };
      const onKey = (ev: KeyboardEvent) => {
        const g = gesture.current;
        if (!g) return;
        if (ev.type === 'keydown' && ev.key === 'Escape') {
          // Esc cancels the drag only; the app's Esc (clear the selection) does not run too.
          ev.preventDefault();
          ev.stopPropagation();
          swallow.current = true;
          end();
          return;
        }
        if (ev.key === 'Alt') {
          ev.preventDefault();
          const next = { ...g, alt: ev.type === 'keydown' };
          gesture.current = next;
          if (next.dragging) live.current.onGhost(ghostOf(next));
        }
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('pointerdown', onOther, true);
      window.addEventListener('keydown', onKey, true);
      window.addEventListener('keyup', onKey, true);
      cleanup.current = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('pointerdown', onOther, true);
        window.removeEventListener('keydown', onKey, true);
        window.removeEventListener('keyup', onKey, true);
      };
    },
    [enabled, toFloor, orbit, end],
  );

  /** Whether the click that ends this press is part of a move (and must not select or open anything). */
  const clicked = useCallback(() => {
    const s = swallow.current;
    swallow.current = false;
    return s;
  }, []);

  return { press, clicked };
}

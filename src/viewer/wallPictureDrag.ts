import { useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Raycaster, Vector2 } from 'three';
import { setWallFinish, wallFinish, wallLength, type WallRect } from '../core/room';
import { dragPicture, pictureRect, wallPlanePoint, type PictureHandle } from '../core/wallPicture';
import { useDesign } from '../store/designStore';
import { DRAG_THRESHOLD_PX } from '../ui/planDrag';
import { S } from './pieceDrag';

/** A tiny store outside React state (as the Move ghost): a pointer move re-renders only what reads it. */
function store<T>(start: T) {
  let now = start;
  const ls = new Set<() => void>();
  return {
    get: () => now,
    set: (v: T) => {
      if (v === now) return;
      now = v;
      ls.forEach((f) => f());
    },
    use: () =>
      useSyncExternalStore(
        (l) => {
          ls.add(l);
          return () => ls.delete(l);
        },
        () => now,
      ),
  };
}

// Adjust wall picture (ADR-146): on until tapped off, this page only, never saved; the wall being adjusted.
const adjust = store(false);
const chosen = store<number | null>(null);
/** The picture rectangle while a drag is in progress. */
const preview = store<{ wall: number; rect: WallRect } | null>(null);

/** Adjust wall picture on, and the switch for it; turning it off forgets the chosen wall. */
export function useAdjustMode(): [boolean, (on: boolean) => void] {
  return [
    adjust.use(),
    (on: boolean) => {
      adjust.set(on);
      if (!on) chosen.set(null);
    },
  ];
}
/** The wall whose picture is being adjusted, and the way to choose one. */
export const useAdjustWall = (): [number | null, (i: number | null) => void] => [
  chosen.use(),
  chosen.set,
];
/** The dragged picture rectangle, or null while nothing is dragged. */
export const usePicturePreview = () => preview.use();

/** Save a wall picture's rectangle (one undo step); `null` = the whole wall again. */
export function setPictureFit(wall: number, rect: WallRect | null) {
  const st = useDesign.getState();
  const room = st.project?.room;
  const f = room && wallFinish(room, wall);
  if (!room || !f?.image) return;
  const { fit: _old, ...img } = f.image;
  void _old;
  st.setRoom(
    setWallFinish(room, wall, { colour: f.colour, image: rect ? { ...img, fit: rect } : img }),
  );
}

/**
 * Dragging a wall picture in the 3D view (ADR-146): the whole picture (pressing its wall) or one of its handles. The
 * pointer is only turned into a point on the wall's plane here; the new rectangle is `dragPicture` (core), snapping
 * with the Snap toggle unless Alt is held. Commits once on release (one undo step); Esc, a second finger or a
 * cancelled pointer drop it unchanged. The camera does not orbit during the drag.
 */
export function usePictureDrag(snapOn: boolean) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  const raycaster = useMemo(() => new Raycaster(), []);
  const ndc = useMemo(() => new Vector2(), []);
  const cleanup = useRef<(() => void) | null>(null);
  const snap = useRef(snapOn);
  useEffect(() => {
    snap.current = snapOn;
  }, [snapOn]);
  const orbit = useCallback(
    (on: boolean) => {
      const c = get().controls as { enabled: boolean } | null;
      if (c) c.enabled = on;
    },
    [get],
  );
  const end = useCallback(() => {
    cleanup.current?.();
    cleanup.current = null;
    preview.set(null);
    orbit(true);
  }, [orbit]);
  useEffect(() => end, [end]);

  /** Screen point → point on wall `wall`'s plane in wall mm, or null when it cannot be read. */
  const onWall = useCallback(
    (clientX: number, clientY: number, wall: number) => {
      const room = useDesign.getState().project?.room;
      const r = gl.domElement.getBoundingClientRect();
      if (!room || r.width <= 0 || r.height <= 0) return null;
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const { origin: o, direction: d } = raycaster.ray;
      return wallPlanePoint(
        { origin: [o.x / S, o.y / S, o.z / S], dir: [d.x, d.y, d.z] },
        room,
        wall,
      );
    },
    [gl, camera, raycaster, ndc],
  );

  return useCallback(
    (
      e: {
        clientX: number;
        clientY: number;
        pointerId: number;
        pointerType: string;
        button: number;
        altKey: boolean;
      },
      wall: number,
      handle: PictureHandle,
    ) => {
      if ((e.pointerType === 'mouse' && e.button !== 0) || cleanup.current) return false;
      const room = useDesign.getState().project?.room;
      const img = room && wallFinish(room, wall)?.image;
      const from = onWall(e.clientX, e.clientY, wall);
      if (!room || !img || !from) return false;
      const start = pictureRect(room, wall, img);
      const size = { len: wallLength(room, wall), height: room.height };
      const { pointerId } = e;
      const sx = e.clientX,
        sy = e.clientY;
      let dragging = false,
        to = from,
        alt = e.altKey;
      orbit(false);
      const show = () =>
        preview.set({
          wall,
          rect: dragPicture(
            start,
            handle,
            to.u - from.u,
            to.y - from.y,
            size,
            snap.current && !alt,
          ),
        });
      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        dragging ||= Math.hypot(ev.clientX - sx, ev.clientY - sy) > DRAG_THRESHOLD_PX;
        if (!dragging) return;
        // Along the wall seen edge-on, keep the last readable point.
        to = onWall(ev.clientX, ev.clientY, wall) ?? to;
        alt = ev.altKey;
        show();
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const p = preview.get();
        end();
        if (dragging && p) setPictureFit(wall, p.rect);
      };
      const cancel = (ev: Event) => {
        if (ev instanceof PointerEvent && ev.pointerId === pointerId && ev.type === 'pointerdown')
          return;
        if (ev instanceof PointerEvent && ev.type === 'pointercancel' && ev.pointerId !== pointerId)
          return;
        if (ev instanceof KeyboardEvent) {
          if (ev.key === 'Alt') {
            alt = ev.type === 'keydown';
            if (dragging) show();
            return;
          }
          if (ev.type !== 'keydown' || ev.key !== 'Escape') return;
          // Esc cancels the drag only; the app's Esc (clear the selection) does not run too.
          ev.preventDefault();
          ev.stopPropagation();
        }
        end();
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', cancel);
      window.addEventListener('pointerdown', cancel, true);
      window.addEventListener('keydown', cancel, true);
      window.addEventListener('keyup', cancel, true);
      cleanup.current = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', cancel);
        window.removeEventListener('pointerdown', cancel, true);
        window.removeEventListener('keydown', cancel, true);
        window.removeEventListener('keyup', cancel, true);
      };
      return true;
    },
    [onWall, orbit, end],
  );
}

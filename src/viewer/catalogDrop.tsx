import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Raycaster, Vector2, type Camera } from 'three';
import { floorPoint, type FloorPoint } from '../core/drag3d';
import { boxCentre } from '../core/geometry';
import { dropNewPiece } from '../core/snap';
import { useDesign } from '../store/designStore';
import { registerViewHit, usePieceList } from '../store/pieceListStore';
import { SELECT } from './panelResources';
import { S } from './pieceDrag';

/** The part of the screen the 3D canvas covers, in client pixels. */
interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where a catalog item dragged over the 3D view lands (ADR-303): the screen point is turned into a ray through the
 * camera and that ray into a point on the floor plane (height 0) with ADR-093's projection (`floorPoint`). Null
 * outside the canvas, towards the horizon or past the camera's reach. The point is the same room point a release on
 * the plan gives (x along the back wall, z away from it); the drop itself is the plan's (`dropNewPiece`). Never throws.
 */
export function catalogDropPoint(
  camera: Camera,
  rect: Rect,
  clientX: number,
  clientY: number,
): FloorPoint | null {
  if (!(rect.width > 0 && rect.height > 0)) return null;
  const u = (clientX - rect.left) / rect.width,
    v = (clientY - rect.top) / rect.height;
  if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) return null;
  const ray = new Raycaster();
  ray.setFromCamera(new Vector2(u * 2 - 1, -(v * 2 - 1)), camera);
  const { origin: o, direction: d } = ray.ray;
  return floorPoint({ origin: [o.x / S, o.y / S, o.z / S], dir: [d.x, d.y, d.z] }, 0);
}

/**
 * The 3D view as a drop target for the piece list (ADR-303): while mounted it registers the screen-to-floor point
 * the list's drag reads, and draws the piece where a release would put it (the core's drop, snapped with the Snap
 * toggle unless Alt is held). Display only, never picked.
 */
export function CatalogDrop({ snapOn }: { snapOn: boolean }) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    registerViewHit((cx, cy) => {
      const { gl, camera } = get();
      const el = gl.domElement;
      // Only the canvas itself, not a toolbar, note or sheet drawn over it.
      const hit =
        typeof document.elementFromPoint === 'function' && document.elementFromPoint(cx, cy);
      if (hit !== el) return null;
      return catalogDropPoint(camera, el.getBoundingClientRect(), cx, cy);
    });
    return () => registerViewHit(null);
  }, [get]);
  const drag = usePieceList((s) => s.drag);
  const project = useDesign((s) => s.project);
  const pieces = useDesign((s) => s.projectModel?.pieces);
  const target = useMemo(
    () =>
      drag?.room && project && pieces
        ? dropNewPiece(project, pieces, drag.me, drag.room, snapOn && !drag.alt)
        : null,
    [drag, project, pieces, snapOn],
  );
  if (!target) return null;
  const b = target.box,
    c = boxCentre(b);
  return (
    <mesh position={[c.x * S, c.y * S, c.z * S]} raycast={() => null} renderOrder={5}>
      <boxGeometry args={[b.w * S, b.h * S, b.d * S]} />
      <meshBasicMaterial
        color={target.snap ? '#2e7d4f' : SELECT}
        transparent
        opacity={0.28}
        depthWrite={false}
      />
    </mesh>
  );
}

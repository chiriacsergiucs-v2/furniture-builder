import { setWallFinish, wallEnds, wallFinish, type Room, type WallFinish } from '../core/room';
import { useDesign } from '../store/designStore';

/** Apply a finish to the latest matching wall, never the stale room captured before an await (ADR-200). */
export function applyWallFinish(
  projectId: string,
  source: Room,
  wall: number,
  next: Omit<WallFinish, 'wall'> | undefined,
): boolean {
  const st = useDesign.getState();
  const room = st.project?.room;
  if (
    st.project?.id !== projectId ||
    !room ||
    wall < 0 ||
    wall >= room.outline.length ||
    wall >= source.outline.length
  )
    return false;
  const a = wallEnds(source, wall),
    b = wallEnds(room, wall);
  if (a.some((point, i) => point[0] !== b[i][0] || point[1] !== b[i][1])) return false;
  if (wallFinish(room, wall) !== wallFinish(source, wall)) return false;
  st.setRoom(setWallFinish(room, wall, next));
  return true;
}

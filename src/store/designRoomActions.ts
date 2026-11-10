import { modelDrop, moveModelTo } from '../core/modelPlace';
import { moveItems } from '../core/selection';
import { closeOutline, DEFAULT_ROOM_HEIGHT, keepWallFinishes, snapCorner } from '../core/room';
import { PROJECT_SCHEMA, tapPosition } from '../core/project';
import type { State, StoreHelpers } from './designState';

export type RoomActions = Pick<
  State,
  | 'placeAt'
  | 'stopPlacing'
  | 'setRoom'
  | 'startDrawRoom'
  | 'addRoomCorner'
  | 'finishDrawRoom'
  | 'cancelDrawRoom'
  | 'dropModel'
  | 'startScalePlan'
  | 'addScalePoint'
  | 'cancelScalePlan'
>;

/** The placing, room-drawing and plan-scale actions, split out of designStore.ts. */
export function roomActions(h: StoreHelpers): RoomActions {
  const { set, get, commitProject } = h;
  return {
    placeAt: (x, z) => {
      const { project: p, placingItemId: id, placingIds } = get();
      const it = p?.items.find((i) => i.id === id);
      set({ placingItemId: null, placingIds: [] });
      if (!p || !it) return;
      const position = tapPosition(it, x, z);
      // A just-inserted template moves as a block, in the same undo step as its insert (ADR-123).
      if (placingIds.length) {
        const left = Math.min(
          ...p.items.filter((i) => placingIds.includes(i.id)).map((i) => i.position.x),
        );
        const back = Math.min(
          ...p.items.filter((i) => placingIds.includes(i.id)).map((i) => i.position.z),
        );
        const res = moveItems(p, placingIds, position.x - left, position.z - back);
        if (!res.reason && res.project !== p)
          commitProject(res.project, undefined, { amend: true });
        return;
      }
      commitProject({ ...p, items: p.items.map((i) => (i.id === it.id ? { ...i, position } : i)) });
    },
    stopPlacing: () => set({ placingItemId: null, placingIds: [] }),
    setRoom: (room) => {
      const p = get().project;
      if (!p) return;
      // A room may now hold pipes and outlets (ADR-072): it is saved at the current project version.
      if (room) commitProject({ ...p, room, schemaVersion: PROJECT_SCHEMA });
      else {
        const { room: _r, ...rest } = p;
        void _r;
        commitProject(rest);
      }
    },
    startDrawRoom: () => set({ drawingRoom: [], placingItemId: null }),
    addRoomCorner: (x, z) => {
      const pts = get().drawingRoom;
      if (pts)
        set({
          drawingRoom: [
            ...pts,
            snapCorner(pts[pts.length - 1], x, z, 10, pts.length >= 2 ? pts[0] : undefined),
          ],
        });
    },
    finishDrawRoom: () => {
      const { drawingRoom: pts, project: p } = get();
      if (!p || !pts || pts.length < 3) return false;
      set({ drawingRoom: null });
      commitProject({
        ...p,
        room: {
          height: p.room?.height ?? DEFAULT_ROOM_HEIGHT,
          features: p.room?.features ?? [],
          outline: closeOutline(pts),
          // Wall backgrounds stay on the walls the new outline still has (ADR-145).
          ...keepWallFinishes(p.room?.walls, closeOutline(pts)),
        },
      });
      return true;
    },
    cancelDrawRoom: () => set({ drawingRoom: null }),
    dropModel: (id, dx, dz, snap) => {
      const p = get().project;
      const pieces = get().projectModel?.pieces;
      if (!p || !pieces) return;
      const d = modelDrop(p, pieces, id, dx, dz, snap);
      if (!d) return;
      const next = moveModelTo(p, id, d.position);
      if (next !== p) commitProject(next);
    },
    startScalePlan: () => set({ scalingPlan: [], drawingRoom: null, placingItemId: null }),
    addScalePoint: (pt) => {
      const pts = get().scalingPlan;
      const p = get().project;
      if (!pts || !p?.planPicture) return;
      if (!pts.length) return set({ scalingPlan: [pt] });
      set({ scalingPlan: null });
      const a = pts[0];
      // Two taps on the same pixel give no distance: the scale stays as it was.
      if (a[0] === pt[0] && a[1] === pt[1]) return;
      commitProject({ ...p, planPicture: { ...p.planPicture, a, b: pt } });
    },
    cancelScalePlan: () => set({ scalingPlan: null }),
  };
}

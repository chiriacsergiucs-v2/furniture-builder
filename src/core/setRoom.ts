/**
 * The room of a value set (ADR-167): the project's one room translated to the set's origin, drawn and checked there,
 * never stored twice (ADR-011). Kept apart from `sets.ts` so `project.ts` can use it without a cycle.
 */
import type { Room } from './room';

export interface VariableSet {
  id: string;
  name: string;
  /** Variable id → a number or formula; absent or empty = not set yet. */
  values: Record<string, string>;
  /** Where the set's pieces and room copy stand, relative to set 1: added to every duplicate's position. */
  origin: { x: number; z: number };
}

/** The room translated to a set's origin. Wall features stay with their wall; free obstacles move along. */
export function roomAt(room: Room, origin: { x: number; z: number }): Room {
  if (!origin.x && !origin.z) return room;
  return {
    ...room,
    outline: room.outline.map(([x, z]) => [x + origin.x, z + origin.z]),
    features: room.features.map((f) =>
      f.wall === null && f.x !== undefined && f.z !== undefined
        ? { ...f, x: f.x + origin.x, z: f.z + origin.z }
        : f,
    ),
    ...(room.shape ? { shape: undefined } : {}),
  };
}

/** Every set that has pieces, with the room drawn for it; empty without a room. */
export function setRooms(project: {
  room?: Room;
  variableSets?: VariableSet[];
  items: { set?: { id: string } }[];
}): { set: VariableSet; room: Room }[] {
  const room = project.room;
  if (!room) return [];
  return (project.variableSets ?? [])
    .filter((s) => project.items.some((i) => i.set?.id === s.id))
    .map((set) => ({ set, room: roomAt(room, set.origin) }));
}

// The project builder shared by the Move to tests (ADR-147, ADR-182; cleanup audit 2026-11-09, item 9).
import { templates } from '../../src/core/design';
import {
  makeItem,
  newProject,
  resolvePlacements,
  type Placement,
  type Project,
  type ProjectItem,
} from '../../src/core/project';
import { shapeOutline, type Room } from '../../src/core/room';

const t = (id: string) => templates.find((x) => x.id === id)!.create();

export interface Spec {
  tpl: string;
  x: number;
  z?: number;
  r?: ProjectItem['rotationY'];
  placement?: Placement;
  angle?: number;
  locked?: true;
}

/** A project with the given pieces (ids p0, p1, …), in a 4000 × 3000 × 2500 room unless `withRoom` is false. */
export function moveToProject(pieces: Spec[], name = 'Move to', withRoom = true): Project {
  let p = newProject(name);
  pieces.forEach((s, i) => {
    const it = makeItem(p, t(s.tpl));
    p = {
      ...p,
      items: [
        ...p.items,
        {
          ...it,
          id: `p${i}`,
          position: { ...it.position, x: s.x, z: s.z ?? 0 },
          rotationY: s.r ?? 0,
          ...(s.placement ? { placement: s.placement } : {}),
          ...(s.angle ? { angle: s.angle } : {}),
          ...(s.locked ? { locked: s.locked } : {}),
        },
      ],
    };
  });
  const room: Room = {
    height: 2500,
    outline: shapeOutline('rectangle', {
      width: 4000,
      depth: 3000,
      cutWidth: 0,
      cutDepth: 0,
      offset: 0,
    }),
    features: [],
  };
  return resolvePlacements(withRoom ? { ...p, room } : p);
}

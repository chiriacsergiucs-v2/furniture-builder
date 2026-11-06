// Angled outlines turn with the piece (ADR-203, G-172), the logic part: the selection outline of a space or the whole
// piece inside a piece typed at an angle (ADR-121) is placed by `pieceBoxToRoom` with the same yaw its panels carry, so
// the viewer's YawGroup turns it with them; unturned, it encloses the selected space's panels as in the piece itself.
// The Move ghost turns each board by its own panel yaw. The drawing itself is checked in tools/piece-safety/find-it.mjs.
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { templates } from '../src/core/design';
import { inSelection, selectionBox } from '../src/core/selectPath';
import {
  buildProjectModel,
  makeItem,
  newProject,
  pieceBoxToRoom,
  type Project,
  type ProjectItem,
} from '../src/core/project';
import type { Box } from '../src/core/types';

const t = (id: string) => templates.find((x) => x.id === id)!.create();

function oneAt(rotationY: ProjectItem['rotationY'], angle?: number): Project {
  const p = newProject('Angled');
  const it = makeItem(p, t('sideboard'));
  return { ...p, items: [{ ...it, rotationY, ...(angle ? { angle } : {}) }] };
}
const inside = (outer: Box, b: Box) =>
  b.x >= outer.x - 0.5 &&
  b.y >= outer.y - 0.5 &&
  b.z >= outer.z - 0.5 &&
  b.x + b.w <= outer.x + outer.w + 0.5 &&
  b.y + b.h <= outer.y + outer.h + 0.5 &&
  b.z + b.d <= outer.z + outer.d + 0.5;

describe('the selection outline of an angled piece turns with it (ADR-203, G-172)', () => {
  for (const rotationY of [0, 90, 180, 270] as const)
    it(`quarter turn ${rotationY} + 30°: the outline carries its panels' yaw and encloses them unturned`, () => {
      const p = oneAt(rotationY, 30);
      const item = p.items[0];
      const built = buildModel(item.design);
      const room = buildProjectModel(p).model.panels.filter((x) => x.id.startsWith(`${item.id}:`));
      expect(room.length).toBeGreaterThan(0);
      const yaw = room[0].box.yaw;
      expect(yaw?.deg).toBe(30);
      // Every panel of the piece turns about the same line.
      for (const x of room) expect(x.box.yaw).toEqual(yaw);

      // The whole piece selected: the outline carries the same yaw and, unturned, holds every panel.
      const whole = pieceBoxToRoom(item, built, selectionBox(built, null)!);
      expect(whole.yaw).toEqual(yaw);
      for (const x of room) {
        const { yaw: _y, ...flat } = x.box;
        void _y;
        expect(inside(whole, flat)).toBe(true);
      }

      // A bay selected: the same yaw, and its unturned box holds the bay's own panels (shelves, its door).
      const bay = built.spaces.find((s) => s.view !== 'side' && s.depth === 1)!;
      const outline = pieceBoxToRoom(item, built, bay.box);
      expect(outline.yaw).toEqual(yaw);
      const own = built.panels.filter((x) => inSelection(bay.box, x.box));
      expect(own.length).toBeGreaterThan(0);
      for (const x of own) {
        const placed = room.find((r) => r.id === `${item.id}:${x.id}`)!;
        const { yaw: _y, ...flat } = placed.box;
        void _y;
        const c = { x: flat.x + flat.w / 2, y: flat.y + flat.h / 2, z: flat.z + flat.d / 2 };
        // Its centre lies inside the outline in the plane the outline is drawn in.
        expect(c.y).toBeGreaterThanOrEqual(outline.y - 0.5);
        expect(c.y).toBeLessThanOrEqual(outline.y + outline.h + 0.5);
        const across = rotationY % 180 === 0;
        const [lo, hi, v] = across
          ? [outline.x, outline.x + outline.w, c.x]
          : [outline.z, outline.z + outline.d, c.z];
        expect(v).toBeGreaterThanOrEqual(lo - 0.5);
        expect(v).toBeLessThanOrEqual(hi + 0.5);
      }
    });

  it('a piece without an extra angle has no yaw: the outline is drawn as it is', () => {
    const p = oneAt(90);
    const item = p.items[0];
    const built = buildModel(item.design);
    expect(pieceBoxToRoom(item, built, built.bounds).yaw).toBeUndefined();
    expect(buildProjectModel(p).model.panels.every((x) => !x.box.yaw)).toBe(true);
  });
});

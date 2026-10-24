import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { localClearances } from '../src/core/clearance';
import { templates } from '../src/core/design';
import {
  buildProjectModel,
  makeItem,
  newProject,
  placeItem,
  type Project,
  type QuarterTurn,
} from '../src/core/project';
import type { Design } from '../src/core/types';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
function facing(gap: number, other = t('wardrobe'), turn: QuarterTurn = 180): Project {
  let p = newProject('Clearance');
  p = { ...p, items: [makeItem(p, t('chest'))] };
  const chest = placeItem(p.items[0]).bounds;
  const it = makeItem(p, other);
  return {
    ...p,
    items: [
      ...p.items,
      { ...it, rotationY: turn, position: { x: 0, y: 0, z: chest.z + chest.d + gap } },
    ],
  };
}
const codes = (p: Project) => buildProjectModel(p).diagnostics.map((d) => d.code);

describe('opening clearance (ADR-057)', () => {
  it('drawers need their box depth, doors their width, sliding doors nothing', () => {
    const chest = localClearances(buildModel(t('chest')));
    expect(chest.length).toBeGreaterThan(0);
    const sides = buildModel(t('chest')).panels.filter((p) => p.role === 'drawer-side');
    expect(chest[0].need).toBe(Math.max(...sides.map((p) => p.box.d)));
    const door = localClearances(buildModel(t('base-door')))[0];
    expect(door.need).toBe(door.box.w);
    const sliding = (d: Design) => buildModel(d).panels.some((p) => /^Sliding door/.test(p.label));
    const slid = templates.map((x) => x.create()).find(sliding);
    if (slid)
      expect(localClearances(buildModel(slid)).some((c) => /Sliding/.test(c.label))).toBe(false);
  });
  it('a wardrobe 300 mm in front of a chest of drawers blocks them, naming both; 600 mm free is fine for these drawers', () => {
    const p = facing(300);
    const pm = buildProjectModel(p);
    const w = pm.diagnostics.filter((d) => d.code === 'opening-blocked');
    expect(w.length).toBeGreaterThan(0);
    expect(w[0].severity).toBe('warning');
    expect(
      w.some(
        (d) =>
          d.message.includes('of Chest of drawers cannot open fully: it hits Wardrobe (needs ') &&
          d.message.includes(', 300 mm free).'),
      ),
    ).toBe(true);
    expect(pm.blocked.length).toBeGreaterThan(0);
    expect(pm.diagnostics.some((d) => d.severity === 'error')).toBe(false);
    const need = localClearances(buildModel(t('chest')))[0].need;
    expect(
      codes(facing(need + 700)).filter((c) => c === 'opening-blocked' || c === 'openings-clash'),
    ).toEqual([]);
  });
  it('two pieces whose fronts open into the same space clash', () => {
    const need = localClearances(buildModel(t('chest')))[0].need;
    const p = facing(need + 100, t('chest'));
    expect(codes(p)).toContain('openings-clash');
  });
});

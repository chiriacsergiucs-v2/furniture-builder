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
  });
  it('sliding doors move in their own plane: a cabinet with only sliding doors needs no clearance', () => {
    const d = t('base-door');
    const slid: Design =
      d.product.kind === 'cabinet'
        ? {
            ...d,
            product: {
              ...d.product,
              params: {
                ...d.product.params,
                width: 1200,
                interior: {
                  ...d.product.params.interior,
                  front: { kind: 'sliding', count: 2, overlap: 30, track: 80 },
                },
              },
            },
          }
        : d;
    const m = buildModel(slid);
    expect(m.diagnostics.filter((x) => x.severity === 'error')).toEqual([]);
    expect(m.panels.filter((p) => /^Sliding door/.test(p.label))).toHaveLength(2);
    expect(localClearances(m)).toEqual([]);
    let p = newProject('Sliding');
    p = { ...p, items: [makeItem(p, slid)] };
    expect(placeItem(p.items[0]).clearances).toEqual([]);
  });
  it('two door cabinets in an L corner (one turned 90°) whose doors swing into the same space clash', () => {
    let p = newProject('Corner');
    const a = makeItem(p, t('base-door'));
    const b = makeItem(p, t('base-door'));
    p = {
      ...p,
      items: [
        { ...a, position: { x: 600, y: 0, z: 0 } },
        { ...b, rotationY: 90, position: { x: 0, y: 0, z: 600 } },
      ],
    };
    const [pa, pb] = p.items.map((i) => placeItem(i));
    expect(pb.facing).toEqual({ axis: 'x', sign: 1 });
    // The bodies stay clear of each other and of each other's swing; only the swings meet.
    expect(pa.bounds.z + pa.bounds.d).toBeLessThanOrEqual(600);
    expect(pb.bounds.x + pb.bounds.w).toBeLessThanOrEqual(600);
    const c = codes(p);
    expect(c).toContain('openings-clash');
    expect(c).not.toContain('pieces-overlap');
    expect(c).not.toContain('opening-blocked');
  });
  it('free space exactly the need is enough; one millimetre less warns', () => {
    const need = Math.max(...localClearances(buildModel(t('chest'))).map((c) => c.need));
    const blocked = (gap: number) =>
      buildProjectModel(facing(gap, t('wardrobe'), 0)).diagnostics.filter(
        (d) => d.code === 'opening-blocked',
      );
    expect(blocked(need)).toEqual([]);
    const short = blocked(need - 1);
    expect(short.length).toBeGreaterThan(0);
    expect(short.some((d) => d.message.includes(`(needs ${need} mm, ${need - 1} mm free)`))).toBe(
      true,
    );
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

/** A base cabinet whose single door hinges on `hinge`. */
function hinged(hinge: 'left' | 'right'): Design {
  const d = t('base-door');
  if (d.product.kind !== 'cabinet') throw new Error('cabinet expected');
  const interior = d.product.params.interior;
  return {
    ...d,
    product: {
      ...d.product,
      params: {
        ...d.product.params,
        interior: { ...interior, front: { kind: 'doors', count: 1, hinge } },
      },
    },
  };
}

/**
 * A base cabinet hinged on `hinge` and a second one standing with its near corner 50 mm into the far corner (on the
 * `corner` side) of the first one's door box: outside the swing of a door hinged on the other side, inside the swing
 * of one hinged on that side.
 */
function cornerProject(hinge: 'left' | 'right', corner: 'left' | 'right' = 'right'): Project {
  let p = newProject('Swing');
  p = { ...p, items: [makeItem(p, hinged(hinge))] };
  const c = placeItem(p.items[0]).clearances[0];
  const other = makeItem(p, t('base-door'));
  const w = placeItem(other).bounds.w;
  const x = corner === 'right' ? c.box.x + c.box.w - 50 : c.box.x + 50 - w;
  return {
    ...p,
    items: [...p.items, { ...other, position: { x, y: 0, z: c.box.z + c.box.d - 50 } }],
  };
}
const blockedDoor = (p: Project) =>
  buildProjectModel(p).diagnostics.filter(
    (d) => d.code === 'opening-blocked' && d.nodeId === p.items[0].id,
  );

describe('door swing arc (G-011)', () => {
  it('a single door swings a quarter circle about its hinge edge, a pair about their outer edges', () => {
    for (const hinge of ['left', 'right'] as const) {
      const [c] = localClearances(buildModel(hinged(hinge)));
      expect(c.arc).toEqual({
        pivot: [hinge === 'left' ? c.box.x : c.box.x + c.box.w, c.box.z],
        r2: c.box.w * c.box.w,
      });
    }
    const d = t('base-door');
    const pair: Design =
      d.product.kind === 'cabinet'
        ? {
            ...d,
            product: {
              ...d.product,
              params: {
                ...d.product.params,
                width: 900,
                interior: { ...d.product.params.interior, front: { kind: 'doors', count: 2 } },
              },
            },
          }
        : d;
    const [l, r] = localClearances(buildModel(pair));
    expect(l.arc?.pivot).toEqual([l.box.x, l.box.z]);
    expect(r.arc?.pivot).toEqual([r.box.x + r.box.w, r.box.z]);
  });
  it('drawers and flaps keep the whole box', () => {
    for (const c of localClearances(buildModel(t('chest')))) expect(c.arc).toBeUndefined();
  });
  it('a piece in the box corner away from the hinge, outside the swing, does not block the door', () => {
    expect(blockedDoor(cornerProject('left'))).toEqual([]);
    expect(blockedDoor(cornerProject('right', 'left'))).toEqual([]);
  });
  it('the same piece on the hinge side of the swing blocks it, as a warning', () => {
    for (const [h, side] of [
      ['right', 'right'],
      ['left', 'left'],
    ] as const) {
      const ds = blockedDoor(cornerProject(h, side));
      expect(ds).toHaveLength(1);
      expect(ds[0].severity).toBe('warning');
    }
  });
  it('the swing turns and moves with the piece', () => {
    let p = newProject('Turned');
    const it = makeItem(p, hinged('left'));
    p = { ...p, items: [{ ...it, rotationY: 90, position: { x: 0, y: 0, z: 1000 } }] };
    const [c] = placeItem(p.items[0]).clearances;
    // Facing +x, the door's left edge (seen from the front) is at the far z end of its box.
    expect(c.arc?.pivot).toEqual([c.box.x, c.box.z + c.box.d]);
    expect(c.arc?.r2).toBe(c.box.d * c.box.d);
  });
});

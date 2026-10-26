import { beforeEach, describe, expect, it } from 'vitest';
import {
  duplicateItem,
  HANDED_FIELDS,
  mirrorDesign,
  mirrorItem,
  mirrorRun,
  NOTHING_TO_MIRROR,
  touchingRun,
  turnAboutCentre,
} from '../src/core/arrange';
import { buildModel } from '../src/core/build';
import { catalogFamilies, insertVariant } from '../src/core/catalog';
import { cutlist } from '../src/core/cutlist';
import { cornerDefaults, deskDefaults, frameDefaults, templates, wrap } from '../src/core/design';
import {
  buildProjectModel,
  makeItem,
  newProject,
  placedBounds,
  resolvePlacements,
  type Project,
  type ProjectItem,
} from '../src/core/project';
import type { Design, Product, Space } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
function project(designs: Design[]): Project {
  let p = newProject('Arrange');
  for (const d of designs) p = { ...p, items: [...p.items, makeItem(p, d)] };
  return p;
}
const boundsOf = (p: Project, id: string) =>
  placedBounds(resolvePlacements(p).items.find((i) => i.id === id)!);
/** Every part's cut size, one entry per part (drilling notes may follow the mirrored parts). */
const sizes = (d: Design) =>
  cutlist(buildModel(d), d.materials)
    .flatMap((r) =>
      Array.from(
        { length: r.quantity },
        () => `${r.materialId}|${r.thickness}|${r.length}×${r.width}|L${r.edgesL}W${r.edgesW}`,
      ),
    )
    .sort();
/** Every part's material and edges with its length and width, in a stable order for a ±1 mm comparison. */
const dims = (d: Design) =>
  cutlist(buildModel(d), d.materials)
    .flatMap((r) =>
      Array.from({ length: r.quantity }, () => ({
        key: `${r.materialId}|${r.thickness}|L${r.edgesL}W${r.edgesW}`,
        l: r.length,
        w: r.width,
      })),
    )
    .sort((a, b) => a.key.localeCompare(b.key) || a.l - b.l || a.w - b.w);
const hinges = (s: Space): string[] => [
  ...(s.front?.kind === 'doors' && s.front.count === 1 ? [s.front.hinge ?? 'left'] : []),
  ...(s.kind === 'split' ? s.children.flatMap(hinges) : []),
];

describe('duplicate in place (ADR-069)', () => {
  it('gives a touching copy on the right with new ids, same turn, placement and quantity', () => {
    let p = project([t('base-door')]);
    const a = p.items[0];
    p = { ...p, items: [{ ...a, quantity: 2, rotationY: 0 }] };
    const res = duplicateItem(p, a.id)!;
    expect(res.project.items).toHaveLength(2);
    const copy = res.project.items[1];
    expect(copy.id).toBe(res.id);
    expect(copy.id).not.toBe(a.id);
    expect(copy.design.id).not.toBe(a.design.id);
    expect(copy.quantity).toBe(2);
    expect(copy.placement).toEqual(a.placement);
    const ba = boundsOf(res.project, a.id),
      bc = boundsOf(res.project, copy.id);
    expect(bc.x).toBe(ba.x + ba.w);
    expect({ ...bc, x: 0 }).toEqual({ ...ba, x: 0 });
    expect(
      buildProjectModel(res.project).diagnostics.filter((d) => d.code === 'pieces-overlap'),
    ).toEqual([]);
  });

  it('goes on the left when the right is taken, and on the right anyway when both are', () => {
    // Left piece at 0, the one to duplicate at 600, another at 1200: both sides taken.
    let p = project([t('base-door'), t('base-door'), t('base-door')]);
    const mid = p.items[1].id;
    const both = duplicateItem(p, mid)!;
    expect(boundsOf(both.project, both.id).x).toBe(1200);
    // Move the left piece away: the left side is free, the right is still taken.
    p = {
      ...p,
      items: p.items.map((i, k) => (k === 0 ? { ...i, position: { ...i.position, x: -3000 } } : i)),
    };
    const left = duplicateItem(p, mid)!;
    expect(boundsOf(left.project, left.id).x).toBe(0);
    expect(duplicateItem(p, 'nope')).toBeNull();
  });

  it('is one undo step in the store and selects the copy', () => {
    const s = () => useDesign.getState();
    s().openProject(project([t('base-door')]));
    const before = s().project!;
    s().duplicateItem(before.items[0].id);
    expect(s().project!.items).toHaveLength(2);
    expect(s().selectedItemId).toBe(s().project!.items[1].id);
    s().undoProject();
    expect(s().project!.items).toEqual(before.items);
  });
});

describe('turn about the centre (ADR-069)', () => {
  const sized = (w: number, depth: number): Design => {
    const d = t('base-door');
    if (d.product.kind !== 'cabinet') throw new Error();
    return { ...d, product: { ...d.product, params: { ...d.product.params, width: w, depth } } };
  };
  const centre2 = (p: Project, id: string) => {
    const b = boundsOf(p, id);
    return { x: 2 * b.x + b.w, z: 2 * b.z + b.d };
  };

  it('keeps the footprint centre within ½ mm and four turns return the same position', () => {
    // Sizes with odd and even width − depth, a few hundred variations (fuzz over sizes).
    for (let w = 401; w <= 1200; w += 37)
      for (let dp = 301; dp <= 700; dp += 53)
        for (const dir of [1, -1] as const) {
          const p0 = project([sized(w, dp)]);
          const id = p0.items[0].id;
          const c0 = centre2(p0, id);
          let p = p0;
          for (let k = 1; k <= 4; k++) {
            p = turnAboutCentre(p, id, dir);
            const c = centre2(p, id);
            expect(Math.abs(c.x - c0.x)).toBeLessThanOrEqual(1);
            expect(Math.abs(c.z - c0.z)).toBeLessThanOrEqual(1);
            if (k === 2) expect(p.items[0].position).toEqual(p0.items[0].position);
          }
          expect(p.items[0].position).toEqual(p0.items[0].position);
          expect(p.items[0].rotationY).toBe(0);
          expect(Number.isInteger(p.items[0].position.x)).toBe(true);
        }
  });

  it('turns the front from facing you to facing right, and back with -1', () => {
    const p0 = project([t('base-door')]);
    const id = p0.items[0].id;
    const p1 = turnAboutCentre(p0, id, 1);
    expect(p1.items[0].rotationY).toBe(90);
    expect(turnAboutCentre(p1, id, -1).items[0]).toEqual(p0.items[0]);
    expect(turnAboutCentre(p0, id, -1).items[0].rotationY).toBe(270);
    expect(turnAboutCentre(p0, 'nope')).toBe(p0);
  });

  it('a piece sitting on another keeps sitting on it: its offset turns with it', () => {
    let p = project([t('base-door'), t('wall-cabinet')]);
    const [base, top] = p.items;
    p = {
      ...p,
      items: [
        base,
        { ...top, placement: { kind: 'above', baseId: base.id, gap: 600, offsetX: 0 } },
      ],
    };
    const turned = resolvePlacements(turnAboutCentre(resolvePlacements(p), top.id));
    const it = turned.items[1];
    expect(it.placement?.kind).toBe('above');
    const b0 = boundsOf(p, top.id),
      b1 = boundsOf(turned, top.id);
    expect(Math.abs(2 * b1.x + b1.w - (2 * b0.x + b0.w))).toBeLessThanOrEqual(1);
  });
});

describe('mirror a piece (ADR-069)', () => {
  const roots: Record<Product['kind'], Design[]> = {
    cabinet: [t('sideboard'), t('base-door'), t('wardrobe')],
    corner: [
      t('corner-blind'),
      t('corner-l'),
      wrap('Diagonal', { kind: 'corner', id: 'c', params: cornerDefaults('diagonal') }),
    ],
    desk: [
      t('desk-pedestal'),
      wrap('Two', {
        kind: 'desk',
        id: 'd',
        params: { ...deskDefaults(), support: 'two-pedestals' },
      }),
    ],
    panel: [],
    frame: [],
    panels: [],
  };
  const handed = Object.values(roots).flat();

  it('mirroring twice gives the same design; the cut-list sizes stay', () => {
    for (const d of handed) {
      const once = mirrorDesign(d);
      expect(once.ok, d.name).toBe(true);
      const twice = mirrorDesign(once.design);
      expect(twice.design, d.name).toEqual(d);
      expect(sizes(once.design), d.name).toEqual(sizes(d));
    }
  });

  it('cabinet: side-by-side spaces reverse and single doors change hinge side', () => {
    const d = t('sideboard');
    const m = mirrorDesign(d).design;
    if (d.product.kind !== 'cabinet' || m.product.kind !== 'cabinet') throw new Error();
    const a = d.product.params.interior,
      b = m.product.params.interior;
    if (a.kind !== 'split' || b.kind !== 'split') throw new Error();
    expect(b.children.map((c) => c.id)).toEqual([...a.children].reverse().map((c) => c.id));
    expect(hinges(a)).toEqual(['left', 'left']);
    expect(hinges(b)).toEqual(['right', 'right']);
    const knob = t('base-door');
    if (knob.product.kind !== 'cabinet') throw new Error();
    knob.product.params.interior = { ...knob.product.params.interior, handle: { kind: 'knob' } };
    const one = mirrorDesign(knob).design;
    if (one.product.kind !== 'cabinet') throw new Error();
    expect(hinges(one.product.params.interior)).toEqual(['right']);
    // The handle goes to the opening edge, so it moves to the left of the door.
    const holes = (x: Design) =>
      buildModel(x).panels.find((p) => p.role === 'door')!.handleHoles!.at[0][0];
    const door = buildModel(knob).panels.find((p) => p.role === 'door')!;
    expect(holes(knob)).toBeGreaterThan(door.box.w / 2);
    expect(holes(one)).toBeLessThan(door.box.w / 2);
  });

  it('desk: pedestal-left ↔ pedestal-right; corner: side swaps', () => {
    const desk = mirrorDesign(t('desk-pedestal')).design;
    expect(desk.product.kind === 'desk' && desk.product.params.support).toBe('pedestal-right');
    const corner = mirrorDesign(t('corner-blind')).design;
    expect(corner.product.kind === 'corner' && corner.product.params.side).toBe('right');
    // The pedestal moves from the left end to the right end.
    const pedX = (d: Design) =>
      Math.min(
        ...buildModel(d)
          .panels.filter((p) => p.role === 'drawer-front')
          .map((p) => p.box.x),
      );
    expect(pedX(desk)).toBeGreaterThan(pedX(t('desk-pedestal')));
  });

  it('panel set: placed parts reflect across the placed parts, sizes kept', () => {
    const d = wrap('Set', {
      kind: 'panels',
      id: 's',
      params: {
        panels: [
          {
            id: 'a',
            name: 'Left',
            length: 700,
            width: 400,
            materialId: 'pal18',
            quantity: 1,
            place: { x: 0, y: 0, z: 0, lie: 'up-z' },
          },
          {
            id: 'b',
            name: 'Top',
            length: 800,
            width: 400,
            materialId: 'pal18',
            quantity: 1,
            place: { x: 0, y: 700, z: 0, lie: 'flat-x' },
          },
          { id: 'c', name: 'Loose', length: 300, width: 200, materialId: 'pal18', quantity: 2 },
        ],
      },
    });
    const m = mirrorDesign(d);
    expect(m.ok).toBe(true);
    if (m.design.product.kind !== 'panels') throw new Error();
    expect(m.design.product.params.panels.map((p) => p.place?.x)).toEqual([782, 0, undefined]);
    expect(mirrorDesign(m.design).design).toEqual(d);
    expect(sizes(m.design)).toEqual(sizes(d));
  });

  it('a piece with nothing to mirror says so and is unchanged', () => {
    const plain: Design[] = [
      t('bookcase'),
      t('chest'),
      t('wall-cabinet'),
      t('desk-gables'),
      t('panels'),
      wrap('Table', { kind: 'frame', id: 'f', params: frameDefaults('table') }),
      wrap('Filler', {
        kind: 'panel',
        id: 'p',
        params: { purpose: 'filler', width: 100, height: 720, materialId: 'pal18' },
      }),
    ];
    for (const d of plain) {
      const m = mirrorDesign(d);
      expect(m.ok, d.name).toBe(false);
      expect(!m.ok && m.reason, d.name).toBe(NOTHING_TO_MIRROR);
      expect(m.design).toBe(d);
    }
    const p = project([t('bookcase')]);
    expect(mirrorItem(p, p.items[0].id)).toEqual({ project: p, reason: NOTHING_TO_MIRROR });
  });

  it('every product kind has its handed fields listed, and every catalog piece mirrors twice back', () => {
    expect(Object.keys(HANDED_FIELDS).sort()).toEqual(
      ['cabinet', 'corner', 'desk', 'frame', 'panel', 'panels'].sort(),
    );
    let mirrored = 0,
      exact = 0;
    for (const f of catalogFamilies)
      for (const v of f.variants) {
        const d = insertVariant(f, v);
        if (!d) continue;
        const once = mirrorDesign(d);
        if (!once.ok) {
          expect(once.design).toBe(d);
          continue;
        }
        mirrored++;
        expect(mirrorDesign(once.design).design, `${f.id}/${v.id}`).toEqual(d);
        // Parts keep their sizes, within the 1 mm the generator's integer split can move (open question).
        const a = dims(d),
          b = dims(once.design);
        expect(b.length, `${f.id}/${v.id}`).toBe(a.length);
        a.forEach((x, i) => {
          expect(b[i].key, `${f.id}/${v.id}`).toBe(x.key);
          expect(
            Math.abs(b[i].l - x.l) + Math.abs(b[i].w - x.w),
            `${f.id}/${v.id}`,
          ).toBeLessThanOrEqual(1);
        });
        if (JSON.stringify(a) === JSON.stringify(b)) exact++;
      }
    expect(mirrored).toBeGreaterThan(0);
    // All but the pieces whose split has an odd rounding remainder keep exactly the same sizes.
    expect(mirrored - exact).toBeLessThanOrEqual(2);
  });
});

describe('mirror a run (ADR-069)', () => {
  const s = () => useDesign.getState();
  let p: Project;
  beforeEach(() => {
    // Sideboard 1600 at 0, base cabinet 600 at 1600, blind corner 1000 at 2200: one run of 3800 mm.
    p = project([t('sideboard'), t('base-door'), t('corner-blind')]);
  });

  it('finds the pieces touching along x', () => {
    expect(touchingRun(p, p.items[1].id)).toEqual(p.items.map((i) => i.id));
    const apart = {
      ...p,
      items: p.items.map((i, k) => (k === 2 ? { ...i, position: { ...i.position, x: 9000 } } : i)),
    };
    expect(touchingRun(apart, p.items[0].id)).toEqual([p.items[0].id, p.items[1].id]);
  });

  it('reflects positions about the run centre and mirrors each piece, one undo step', () => {
    s().openProject(p);
    const before = s().project!;
    const res = s().mirrorRun(before.items[0].id);
    expect(res).toEqual({ reasons: [] });
    const after = s().project!;
    const x = (q: Project, id: string) => boundsOf(q, id).x;
    const [a, b, c] = before.items.map((i) => i.id);
    expect(x(after, c)).toBe(0);
    expect(x(after, b)).toBe(1000);
    expect(x(after, a)).toBe(1600);
    const corner = after.items[2].design.product;
    expect(corner.kind === 'corner' && corner.params.side).toBe('right');
    s().undoProject();
    expect(s().project!.items).toEqual(before.items);
    // Twice gives the same positions and designs.
    const twice = mirrorRun(mirrorRun(before, a).project, a).project;
    expect(twice.items.map((i: ProjectItem) => [i.position, i.design])).toEqual(
      before.items.map((i) => [i.position, i.design]),
    );
  });

  it('a piece with nothing to mirror still moves and is reported', () => {
    const q = project([t('bookcase'), t('base-door')]);
    const res = mirrorRun(q, q.items[0].id);
    expect(res.reasons).toEqual([`Bookcase: ${NOTHING_TO_MIRROR}`]);
    expect(boundsOf(res.project, q.items[0].id).x).toBe(600);
  });

  it('bridges filler gaps up to 150 mm, as run parts do', () => {
    const q = project([t('base-door'), t('base-door'), t('base-door')]);
    const gap = (k: number, dx: number) =>
      q.items.map((i, n) =>
        n >= k ? { ...i, position: { ...i.position, x: i.position.x + dx } } : i,
      );
    expect(touchingRun({ ...q, items: gap(2, 150) }, q.items[0].id)).toHaveLength(3);
    expect(touchingRun({ ...q, items: gap(2, 151) }, q.items[0].id)).toHaveLength(2);
  });

  it('pieces resting on run pieces are mirrored and stay over their base, reflected', () => {
    let q = project([t('sideboard'), t('base-door'), t('wall-cabinet')]);
    const [a, b, w] = q.items;
    q = resolvePlacements({
      ...q,
      items: [a, b, { ...w, placement: { kind: 'above', baseId: a.id, gap: 600, offsetX: 100 } }],
    });
    const res = resolvePlacements(mirrorRun(q, a.id).project);
    const top = res.items[2];
    // The sideboard (1600) moves to 600; the 800 wall cabinet was 100 mm from its left, now 100 mm from its right.
    expect(boundsOf(res, a.id).x).toBe(600);
    expect(top.placement).toEqual({ kind: 'above', baseId: a.id, gap: 600, offsetX: 700 });
    expect(boundsOf(res, w.id).x).toBe(600 + 700);
  });
});

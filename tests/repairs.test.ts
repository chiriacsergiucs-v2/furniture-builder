import { describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import {
  buildProjectModel,
  makeItem,
  newProject,
  placeItem,
  type Project,
  type QuarterTurn,
} from '../src/core/project';
import {
  mayRepair,
  moveItem,
  pieceName,
  repairsFor,
  sameProblem,
  settle,
} from '../src/core/repairs';
import { shapeOutline, type Room } from '../src/core/room';
import type { Diagnostic } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const rect = (w = 3000, d = 3000): Room => ({
  height: 2600,
  outline: shapeOutline('rectangle', { width: w, depth: d, cutWidth: 0, cutDepth: 0, offset: 0 }),
  features: [],
});
function run(ids: string[]): Project {
  let p = newProject('Repairs');
  for (const id of ids) p = { ...p, items: [...p.items, makeItem(p, t(id))] };
  return p;
}
/** Two pieces side by side, the second pushed `by` mm into the first. */
function overlapping(by: number): Project {
  const p = run(['base-door', 'wardrobe']);
  const [a, b] = p.items;
  return {
    ...p,
    items: [a, { ...b, position: { ...b.position, x: b.position.x - by } }],
  };
}
/** A chest with a wardrobe turned to face it, `gap` mm in front (as in the ADR-057 tests). */
function facing(gap: number): Project {
  let p = newProject('Facing');
  p = { ...p, items: [makeItem(p, t('chest'))] };
  const chest = placeItem(p.items[0]).bounds;
  const it = makeItem(p, t('wardrobe'));
  return {
    ...p,
    items: [
      ...p.items,
      { ...it, rotationY: 180, position: { x: 0, y: 0, z: chest.z + chest.d + gap } },
    ],
  };
}
const find = (p: Project, code: string) =>
  buildProjectModel(p).diagnostics.filter((d) => d.code === code);

/** The independent check every offered repair must pass: built again, its problem is gone and no error is new. */
function expectSound(p: Project, d: Diagnostic) {
  const pm = buildProjectModel(p);
  const errs = new Set(
    pm.diagnostics
      .filter((e) => e.severity === 'error')
      .map((e) => `${e.code}|${e.nodeId}|${e.message.replace(/\d+/g, '#')}`),
  );
  const reps = repairsFor(p, pm, d);
  for (const r of reps) {
    const after = buildProjectModel(settle(r.project));
    expect(
      after.diagnostics.some((e) => sameProblem(d, e)),
      r.label,
    ).toBe(false);
    const newErrors = after.diagnostics.filter(
      (e) =>
        e.severity === 'error' &&
        !errs.has(`${e.code}|${e.nodeId}|${e.message.replace(/\d+/g, '#')}`),
    );
    expect(newErrors, r.label).toEqual([]);
    expect(r.preview.length, r.label).toBeGreaterThan(0);
  }
  const ds = reps.map((r) => r.distance);
  expect(ds).toEqual([...ds].sort((a, b) => a - b));
  return reps;
}

describe('where and how much (ADR-071)', () => {
  it('an overlap names both pieces, the shared box and the amount', () => {
    const p = overlapping(34);
    const [d] = find(p, 'pieces-overlap');
    expect(d.itemIds).toEqual(p.items.map((i) => i.id));
    expect(d.amount).toBe(34);
    expect(d.box?.w).toBe(34);
    expect(d.message).toMatch(/overlap by 34 mm/);
  });
  it('a blocked opening names the piece in the way, the front, the zone and the missing space', () => {
    const p = facing(200);
    const ds = find(p, 'opening-blocked');
    expect(ds.length).toBeGreaterThan(0);
    for (const d of ds) {
      expect([...d.itemIds!].sort()).toEqual(p.items.map((i) => i.id).sort());
      expect(d.itemIds![1]).toBe(d.nodeId);
      expect(d.panelIds).toHaveLength(1);
      expect(d.amount).toBeGreaterThan(0);
      expect(d.box!.w * d.box!.d).toBeGreaterThan(0);
      const need = Number(/needs (\d+) mm/.exec(d.message)![1]);
      const free = Number(/(\d+) mm free/.exec(d.message)![1]);
      expect(d.amount).toBe(need - free);
    }
  });
  it('outside the room carries the piece, its outline and how far out it is', () => {
    const p = { ...run(['base-door']), room: rect(3000) };
    const it = p.items[0];
    const w = placeItem(it).bounds.w;
    const out = { ...p, items: [{ ...it, position: { ...it.position, x: 3000 - w + 250 } }] };
    const [d] = find(out, 'outside-room');
    expect(d.itemIds).toEqual([it.id]);
    expect(d.amount).toBe(250);
    expect(d.box).toEqual(placeItem(out.items[0]).bounds);
    expect(d.message).toMatch(/250 mm too far out/);
  });
});

describe('repairs (ADR-071)', () => {
  it('overlap: the smallest move comes first, moves the second piece, and clears the overlap', () => {
    const p = overlapping(34);
    const pm = buildProjectModel(p);
    const [d] = pm.diagnostics.filter((x) => x.code === 'pieces-overlap');
    const reps = expectSound(p, d);
    expect(reps[0].label).toBe(`Move ${p.items[1].design.name} 34 mm to the right`);
    expect(reps[0].distance).toBe(34);
    expect(reps[0].preview.map((x) => x.id)).toEqual([p.items[1].id]);
    expect(find(settle(reps[0].project), 'pieces-overlap')).toEqual([]);
    // Moving it left would put it into the first piece even more: never offered.
    expect(reps.every((r) => !/ to the left$/.test(r.label) || r.distance >= 34)).toBe(true);
  });
  it('blocked opening: the neighbour moves out of the way, or the piece moves with a filler', () => {
    const p = facing(200);
    const pm = buildProjectModel(p);
    const d = pm.diagnostics.find(
      (x) => x.code === 'opening-blocked' && x.nodeId === p.items[0].id,
    )!;
    const reps = expectSound(p, d);
    expect(reps.length).toBeGreaterThan(0);
    // Away from the chest by exactly the space missing.
    const away = reps.find(
      (r) =>
        r.label.startsWith(`Move ${p.items[1].design.name}`) &&
        /away from the back wall$/.test(r.label),
    );
    expect(away?.distance).toBe(d.amount);
  });
  it('outside the room: moves it inside by the amount', () => {
    const p = { ...run(['base-door']), room: rect(3000) };
    const it = p.items[0];
    const w = placeItem(it).bounds.w;
    const out = { ...p, items: [{ ...it, position: { ...it.position, x: 3000 - w + 250 } }] };
    const pm = buildProjectModel(out);
    const [d] = pm.diagnostics.filter((x) => x.code === 'outside-room');
    const reps = expectSound(out, d);
    expect(reps[0].label).toBe(`Move ${it.design.name} 250 mm to the left, inside the room`);
  });
  it('a wall cabinet hung too high is offered to hang lower', () => {
    const p = { ...run(['wall-cabinet']), room: { ...rect(), height: 2000 } };
    const pm = buildProjectModel(p);
    const d = pm.diagnostics.find((x) => x.code === 'outside-room');
    expect(d).toBeDefined();
    const reps = expectSound(p, d!);
    expect(reps[0].label).toMatch(/^Hang .* \d+ mm lower$/);
    expect(reps[0].distance).toBe(d!.amount);
  });
  it('a wall unit hung 10 mm into a tall unit below: the amount is 10 mm and it hangs 10 mm higher', () => {
    let p = run(['wardrobe']);
    const tall = placeItem(p.items[0]).bounds;
    const w = makeItem(p, t('wall-cabinet'));
    p = {
      ...p,
      items: [
        ...p.items,
        {
          ...w,
          position: { x: tall.x, y: tall.h - 10, z: 0 },
          placement: { kind: 'wall', height: tall.h - 10 },
        },
      ],
    };
    const pm = buildProjectModel(p);
    const d = pm.diagnostics.find((x) => x.code === 'pieces-overlap')!;
    expect(d.amount).toBe(10);
    expect(mayRepair(d)).toBe(true);
    const reps = expectSound(p, d);
    expect(reps[0].label).toBe(`Hang ${w.design.name} 10 mm higher`);
  });
  it('a piece placed on another slides along it and never leaves it', () => {
    const p = run(['base-door', 'wall-cabinet']);
    const [a, b] = p.items;
    const on = {
      ...p,
      items: [a, { ...b, placement: { kind: 'above' as const, baseId: a.id, gap: 0, offsetX: 0 } }],
    };
    const moved = moveItem(on, b.id, 40, 0)!;
    expect(moved.items[1].placement).toEqual({ kind: 'above', baseId: a.id, gap: 0, offsetX: 40 });
    expect(moveItem(on, b.id, 0, 40)).toBeNull();
  });
  it('pieces with the same name are told apart by their number', () => {
    const p = run(['base-door', 'base-door', 'chest']);
    const n = p.items[0].design.name;
    expect(pieceName(p, p.items[1].id)).toBe(`${n} (piece 2)`);
    expect(pieceName(p, p.items[2].id)).toBe(p.items[2].design.name);
  });
  it('warnings and errors without a repair family get no repairs', () => {
    const p = overlapping(34);
    expect(
      repairsFor(p, buildProjectModel(p), { severity: 'error', code: 'piece-errors', message: '' }),
    ).toEqual([]);
  });
});

describe('applying a repair (ADR-071)', () => {
  it('is one undo step, and undo brings the problem back', () => {
    const s = () => useDesign.getState();
    s().openProject(overlapping(34));
    const d = s().projectModel!.diagnostics.find((x) => x.code === 'pieces-overlap')!;
    const [r] = repairsFor(s().project!, s().projectModel!, d);
    const past = s().projectPast.length;
    s().updateProject(() => r.project);
    expect(s().projectPast.length).toBe(past + 1);
    expect(s().projectModel!.diagnostics.filter((x) => x.code === 'pieces-overlap')).toEqual([]);
    s().undoProject();
    expect(s().projectModel!.diagnostics.some((x) => sameProblem(d, x))).toBe(true);
  });
});

describe('repairs fuzz over layouts (ADR-071)', () => {
  const N = Number(process.env.FUZZ_N ?? 0) > 0 ? Math.min(Number(process.env.FUZZ_N), 600) : 60;
  it(`${N} seeded layouts: every offered repair clears its problem and adds no error`, () => {
    let seed = 71;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) as number;
    const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
    const ids = ['base-door', 'chest', 'wardrobe', 'bookcase', 'sideboard', 'wall-cabinet'];
    let offered = 0;
    for (let n = 0; n < N; n++) {
      let p = newProject('Fuzz');
      const k = 2 + Math.floor(rnd() * 2);
      for (let i = 0; i < k; i++) {
        const it = makeItem(p, t(pick(ids)));
        const rot = pick<QuarterTurn>([0, 0, 90, 180, 270]);
        p = {
          ...p,
          items: [
            ...p.items,
            {
              ...it,
              rotationY: rot,
              position: {
                x: Math.round(rnd() * 2400),
                y: it.position.y,
                z: Math.round(rnd() * 1600),
              },
            },
          ],
        };
      }
      if (rnd() < 0.5) p = { ...p, room: rect(3000, 2600) };
      const pm = buildProjectModel(p);
      for (const d of pm.diagnostics.filter((x) =>
        ['pieces-overlap', 'opening-blocked', 'outside-room'].includes(x.code),
      )) {
        expect(d.itemIds?.length).toBeGreaterThan(0);
        expect(d.box).toBeDefined();
        offered += expectSound(p, d).length;
      }
    }
    expect(offered).toBeGreaterThan(0);
  });
});

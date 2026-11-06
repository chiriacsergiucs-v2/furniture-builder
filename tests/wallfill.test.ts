/**
 * Fill a wall (ADR-103): mixes fill the wall exactly, stay in the width range, carry no errors, follow Refine, avoid
 * sagging shelves with a centre divider, and equal fronts give equal doors. Includes a seeded fuzz run
 * (FUZZ_N=2000 pnpm exec vitest run tests/wallfill.test.ts for a deeper one).
 */
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { RULE_DEFAULTS } from '../src/core/rules';
import {
  candidates,
  checkWall,
  frontGroups,
  MAX_CANDIDATES,
  MAX_PIECES,
  WALL_HEIGHT,
  WALL_VARIANTS,
  wallRowFor,
  MIXES_FIRST,
  exactSplit,
  mixProject,
  suggestMixes,
  type WallInput,
} from '../src/core/wallfill';
import type { Panel } from '../src/core/types';

const wall = (over: Partial<WallInput> = {}): WallInput => ({
  width: 3000,
  depth: 560,
  height: 2400,
  ...over,
});

const sum = (ws: number[]) => ws.reduce((a, b) => a + b, 0);

describe('suggestMixes', () => {
  it('fills 3000 mm exactly, in range and without errors; the example comes first', () => {
    const r = suggestMixes(wall({ wallRow: 'never' }));
    expect(r.mixes).toHaveLength(MIXES_FIRST);
    for (const m of r.mixes) {
      expect(sum(m.slots.map((s) => s.width))).toBe(3000);
      expect(m.slots.every((s) => s.width >= 400 && s.width <= 1200)).toBe(true);
      expect(m.model.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      // The project pieces stand side by side, exactly as wide as the slots.
      const right = Math.max(...m.model.pieces.map((p) => p.bounds.x + p.bounds.w));
      expect(right).toBe(3000);
    }
    const first = r.mixes[0];
    expect(first.widths).toBe('600 · 600 · 600 · 600 · 600');
    expect(first.summary).toBe('1 tall, 2 open shelves, 1 drawers, 1 door + shelves');
  });

  it('a max width of 600 drops wider pieces; 0 tall cabinets drops tall pieces', () => {
    for (const m of suggestMixes(wall({ maxWidth: 600 })).mixes)
      expect(Math.max(...m.slots.map((s) => s.width))).toBeLessThanOrEqual(600);
    const none = suggestMixes(wall({ tallCount: 0 }));
    expect(none.mixes.length).toBeGreaterThan(0);
    for (const m of none.mixes) expect(m.slots.some((s) => s.kind === 'tall')).toBe(false);
  });

  it('Suggest again with a smaller max width changes the cards', () => {
    const a = suggestMixes(wall()).mixes.map((m) => m.key);
    const b = suggestMixes(wall({ maxWidth: 550 })).mixes.map((m) => m.key);
    expect(b).not.toEqual(a);
  });

  it('3017 mm splits exactly in whole mm, the extra millimetres from the left', () => {
    expect(exactSplit(3017, 5)).toEqual([604, 604, 603, 603, 603]);
    for (const m of suggestMixes(wall({ width: 3017 })).mixes) {
      expect(sum(m.slots.map((s) => s.width))).toBe(3017);
      expect(m.slots.every((s) => Number.isInteger(s.width))).toBe(true);
    }
  });

  it('honours the piece count, tall position and minimum kinds', () => {
    const r = suggestMixes(
      wall({ pieces: 6, tallCount: 2, tallPosition: 'ends', atLeast: { drawers: 2 } }),
    );
    expect(r.mixes.length).toBeGreaterThan(0);
    for (const m of r.mixes) {
      expect(m.slots).toHaveLength(6);
      expect(m.slots[0].kind).toBe('tall');
      expect(m.slots[5].kind).toBe('tall');
      expect(m.slots.filter((s) => s.kind === 'drawers').length).toBeGreaterThanOrEqual(2);
    }
  });

  it('a tall piece above the entered height is still offered, with a warning', () => {
    const r = suggestMixes(wall({ height: 2000 }));
    const m = r.mixes[0];
    expect(m.slots.some((s) => s.kind === 'tall')).toBe(true);
    const w = m.warnings.find((d) => d.code === 'wall-too-tall');
    expect(w?.message).toMatch(/200 mm above the 2000 mm height/);
  });
});

describe('pieces', () => {
  const shelfSpan = (p: Panel) =>
    p.grainAxis === 'x' ? p.box.w : p.grainAxis === 'z' ? p.box.d : p.box.h;

  it('a shelf piece wider than the shelf span gets a centre divider; no shelf exceeds the span', () => {
    for (const kind of ['shelves', 'door', 'tall'] as const) {
      const p = mixProject([{ kind, width: 1200 }], wall({ width: 1200 }));
      const model = buildModel(p.items[0].design);
      const shelves = model.panels.filter((x) => x.role === 'shelf');
      expect(shelves.length).toBeGreaterThan(0);
      for (const s of shelves) expect(shelfSpan(s)).toBeLessThanOrEqual(RULE_DEFAULTS.shelfSpan);
      expect(model.panels.some((x) => x.role === 'divider')).toBe(true);
      expect(
        model.diagnostics.filter((d) => d.code === 'shelf-span' || d.code === 'door-wide'),
      ).toEqual([]);
    }
  });

  it('a narrow shelf piece has no divider', () => {
    const p = mixProject([{ kind: 'shelves', width: 600 }], wall({ width: 600 }));
    expect(buildModel(p.items[0].design).panels.some((x) => x.role === 'divider')).toBe(false);
  });

  it('Equal fronts 6 on 3000 mm gives six doors equal within 1 mm on carcasses in range, insides empty', () => {
    const r = suggestMixes(wall({ equalFronts: 6, tallCount: 0, wallRow: 'never' }));
    expect(r.mixes.length).toBeGreaterThan(1);
    for (const m of r.mixes) {
      expect(sum(m.slots.map((s) => s.width))).toBe(3000);
      expect(m.slots.every((s) => s.width >= 400 && s.width <= 1200)).toBe(true);
      const doors = m.model.model.panels.filter((p) => p.role === 'door');
      expect(doors).toHaveLength(6);
      // Equal within 1 mm: the 3 mm front gap has integer half reveals at the carcass edges (ADR-006).
      const ws = doors.map((d) => d.box.w);
      expect(Math.max(...ws) - Math.min(...ws)).toBeLessThanOrEqual(1);
      expect(
        m.model.model.panels.some((p) => p.role === 'shelf' || p.role === 'drawer-front'),
      ).toBe(false);
    }
    // Carcasses of different widths behind the equal fronts are among the mixes.
    expect(r.mixes.some((m) => new Set(m.slots.map((s) => s.width)).size > 1)).toBe(true);
  });
});

describe('input problems', () => {
  it('wrong input gives errors and no mixes; it never throws', () => {
    for (const bad of [
      wall({ width: 0 }),
      wall({ width: 1.5 }),
      wall({ depth: Number.NaN }),
      wall({ minWidth: 900, maxWidth: 500 }),
      wall({ pieces: 0 }),
      wall({ tallCount: -1 }),
    ]) {
      const r = suggestMixes(bad);
      expect(r.mixes).toEqual([]);
      expect(r.problems.some((p) => p.severity === 'error')).toBe(true);
    }
  });

  it('an empty result says why', () => {
    expect(suggestMixes(wall({ width: 300 })).problems[0].message).toMatch(
      /narrower than the min piece width/,
    );
    expect(suggestMixes(wall({ pieces: 2 })).problems[0].message).toMatch(/No mix fills 3000 mm/);
    expect(suggestMixes(wall({ equalFronts: 30 })).problems[0].message).toMatch(/equal fronts/);
  });

  it('a tiny min width or a huge front count is answered quickly, and says why when nothing fits', () => {
    for (const over of [
      { minWidth: 10 },
      { minWidth: 1, maxWidth: 1200 },
      { equalFronts: 10000 },
      { width: 100000 },
    ]) {
      const t = performance.now();
      const r = suggestMixes(wall(over));
      expect(performance.now() - t).toBeLessThan(3000);
      for (const m of r.mixes) expect(m.slots.length).toBeLessThanOrEqual(MAX_PIECES);
      if (!r.mixes.length) expect(r.problems[0].message).toMatch(/more than 40 pieces/);
    }
  });

  it('Equal fronts with At least bases says they do not apply', () => {
    const r = suggestMixes(wall({ equalFronts: 6, atLeast: { drawers: 2 } }));
    expect(r.mixes.length).toBeGreaterThan(0);
    expect(r.problems.map((p) => p.code)).toContain('wall-atleast-ignored');
    expect(suggestMixes(wall({ equalFronts: 6 })).problems.map((p) => p.code)).not.toContain(
      'wall-atleast-ignored',
    );
  });

  it('a long wall is answered quickly', () => {
    const t = performance.now();
    const r = suggestMixes(wall({ width: 9000 }));
    expect(r.mixes.length).toBe(MIXES_FIRST);
    expect(performance.now() - t).toBeLessThan(3000);
  });
});

describe('wall row (ADR-104)', () => {
  const tops = (m: ReturnType<typeof suggestMixes>['mixes'][number]) =>
    m.model.pieces.filter((p) => p.item.placement?.kind !== 'floor');

  it('with Wall cabinets always, every mix has a wall row over the whole width, tops at the height, in range', () => {
    const r = suggestMixes(wall({ height: 2600, wallRow: 'always' }));
    expect(r.mixes).toHaveLength(MIXES_FIRST);
    for (const m of r.mixes) {
      expect(m.wall).toBeTruthy();
      expect(sum(m.wall!.map((w) => w.width))).toBe(3000);
      expect(m.model.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      for (const p of tops(m)) expect(p.bounds.y + p.bounds.h).toBe(2600);
      for (const w of m.wall!.filter((x) => x.variant !== 'top-box')) {
        expect(w.width).toBeGreaterThanOrEqual(400);
        expect(w.width).toBeLessThanOrEqual(1200);
        expect(w.height).toBe(WALL_HEIGHT);
      }
      expect(m.wallWidths).toBe(m.wall!.map((w) => w.width).join(' · '));
    }
  });

  it('over a 2200 mm tall cabinet: a 400 mm top box of its width at 2600; none at 2200', () => {
    const m = suggestMixes(wall({ height: 2600, wallRow: 'always' })).mixes[0];
    const t = m.slots.findIndex((s) => s.kind === 'tall');
    const box = m.wall!.find((w) => w.variant === 'top-box')!;
    expect(box).toMatchObject({ width: m.slots[t].width, height: 400, over: t });
    const placed = m.model.pieces.find((p) => p.item.design.name.startsWith('Top box'))!;
    expect(placed.bounds.y).toBe(2200);
    expect(placed.bounds.y + placed.bounds.h).toBe(2600);
    for (const n of suggestMixes(wall({ height: 2200, wallRow: 'always' })).mixes)
      expect(n.wall!.some((w) => w.variant === 'top-box')).toBe(false);
  });

  it('any catalog wall variant can appear; open wall shelves past the span get a centre divider', () => {
    const seen = new Set<string>();
    for (const m of suggestMixes(wall({ width: 6000, wallRow: 'always' })).mixes)
      for (const w of m.wall!) seen.add(w.variant);
    for (const v of WALL_VARIANTS) expect(seen.has(v.id)).toBe(true);
    expect(wallRowFor([{ kind: 'shelves', width: 1200 }], wall({ width: 1200 }))!).toHaveLength(2);
    const p = mixProject([{ kind: 'shelves', width: 1200 }], wall({ width: 1200 }), [
      { variant: 'wall-open', width: 1200, height: WALL_HEIGHT, x: 0 },
    ]);
    const model = buildModel(p.items[1].design);
    expect(model.panels.some((x) => x.role === 'divider')).toBe(true);
    expect(model.diagnostics.filter((d) => d.code === 'shelf-span')).toEqual([]);
  });

  it('a wall row that would reach into the base row is not offered, and the wizard says why', () => {
    const always = suggestMixes(wall({ height: 1400, wallRow: 'always' }));
    expect(always.mixes).toEqual([]);
    expect(always.problems[0].message).toMatch(/reach 140 mm into the base row/);
    const any = suggestMixes(wall({ height: 1400, wallRow: 'any' }));
    expect(any.mixes.length).toBeGreaterThan(0);
    expect(any.mixes.every((m) => !m.wall)).toBe(true);
    expect(any.problems.some((p) => p.code === 'wall-row-low')).toBe(true);
  });

  it('a gap over a tall cabinet too thin for a top box is left open and said, the mixes stay', () => {
    const r = suggestMixes(wall({ height: 2230, tallCount: 1 }));
    expect(r.mixes.length).toBeGreaterThan(0);
    for (const m of r.mixes) expect(m.wall!.some((x) => x.variant === 'top-box')).toBe(false);
    expect(r.problems.map((p) => p.code)).toContain('wall-top-box-small');
    expect(suggestMixes(wall({ height: 2600 })).problems.map((p) => p.code)).not.toContain(
      'wall-top-box-small',
    );
  });

  it('a piece problem is reported as one, not as a wall row that does not fit', () => {
    for (const wallRow of ['always', 'any'] as const) {
      const r = suggestMixes(wall({ depth: 30, wallRow }));
      expect(r.mixes).toEqual([]);
      expect(r.problems.map((p) => p.code)).toEqual(['wall-errors']);
    }
  });

  it("always by default (the user's answer); any shows both; never shows none", () => {
    expect(suggestMixes(wall()).mixes.every((m) => m.wall)).toBe(true);
    const any = suggestMixes(wall({ wallRow: 'any' }));
    expect(any.mixes.some((m) => m.wall)).toBe(true);
    expect(any.mixes.some((m) => !m.wall)).toBe(true);
    expect(any.mixes[0].wall).toBeUndefined();
    expect(suggestMixes(wall({ wallRow: 'never' })).mixes.every((m) => !m.wall)).toBe(true);
  });
});

describe('fuzz', () => {
  it('random walls and Refine inputs never throw; mixes fill exactly; empty results say why', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
    const N = Number(process.env.FUZZ_N ?? 150);
    for (let i = 0; i < N; i++) {
      const min = pick([150, 300, 400, 450, 600, 800]);
      const input: WallInput = {
        width: pick([0, 250, 401, 1200, 2317, 3000, 3600, 4999, 6100]),
        depth: pick([300, 400, 560, 600, 700]),
        height: pick([1800, 2100, 2400, 2700]),
        tallDepth: pick([undefined, 400, 600]),
        minWidth: min,
        maxWidth: pick([min, min + 150, 900, 1200]),
        pieces: pick([undefined, undefined, 1, 3, 5, 8]),
        tallCount: pick([undefined, 0, 1, 2, 3]),
        tallPosition: pick([undefined, 'left', 'right', 'ends', 'centre'] as const),
        atLeast: { drawers: pick([undefined, 0, 1, 3]), door: pick([undefined, 1]) },
        equalFronts: pick([undefined, undefined, undefined, 4, 6, 9]),
        wallRow: pick([undefined, 'any', 'always', 'never'] as const),
        wallHeight: pick([undefined, 360, 720, 900]),
        // ADR-204: tall cabinet height, wall cabinet depth and 3- or 4-front carcasses.
        tallHeight: pick([undefined, 1800, 2000, 2200, 2500]),
        wallDepth: pick([undefined, 250, 320, 350, 400]),
      };
      if (rnd() < 0.2) input.equalFronts = pick([3, 7, 8, 10, 12]);
      const r = suggestMixes(input);
      if (!r.mixes.length) expect(r.problems.length).toBeGreaterThan(0);
      for (const m of r.mixes) {
        expect(sum(m.slots.map((s) => s.width))).toBe(input.width);
        if (m.wall) expect(sum(m.wall.map((s) => s.width))).toBeLessThanOrEqual(input.width);
        expect(m.model.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        expect(m.slots.every((s) => s.width >= input.minWidth! && s.width <= input.maxWidth!)).toBe(
          true,
        );
      }
    }
  }, 600_000);
});

// ADR-204: tall cabinet height and wall cabinet depth, a width per base kind, carcasses of 3 or 4 equal fronts.
describe('Refine: tall cabinet height and wall cabinet depth (ADR-204)', () => {
  const isTop = (name: string) => name.startsWith('Top box');
  it('tallHeight 2000: every tall cabinet is 2000 high, the top box fills the rest; no above-height warning on 2100', () => {
    const r = suggestMixes(wall({ height: 2400, tallHeight: 2000, wallRow: 'always' }));
    expect(r.mixes.length).toBeGreaterThan(0);
    for (const m of r.mixes) {
      const talls = m.model.pieces.filter((p) => p.item.design.name.startsWith('Tall'));
      expect(talls.length).toBeGreaterThan(0);
      for (const p of talls) expect(p.bounds.y + p.bounds.h).toBe(2000);
      const box = m.wall!.find((w) => w.variant === 'top-box')!;
      expect(box.height).toBe(400);
      const placed = m.model.pieces.find((p) => isTop(p.item.design.name))!;
      expect(placed.bounds.y).toBe(2000);
      expect(placed.bounds.y + placed.bounds.h).toBe(2400);
    }
    const low = suggestMixes(wall({ height: 2100, tallHeight: 2000 }));
    expect(low.mixes.length).toBeGreaterThan(0);
    for (const m of low.mixes) expect(m.warnings.map((w) => w.code)).not.toContain('wall-too-tall');
    // Without it the catalog's 2200 stands 100 mm above the same wall, with the warning (kept, ADR-103).
    const dflt = suggestMixes(wall({ height: 2100 }));
    expect(dflt.mixes[0].warnings.find((w) => w.code === 'wall-too-tall')?.message).toMatch(
      /100 mm above the 2100 mm height/,
    );
  });
  const depthOf = (p: { item: { design: { product: { params: unknown } } } }) =>
    (p.item.design.product.params as { depth: number }).depth;
  it('wallDepth 350: every wall cabinet is 350 deep; absent: the catalog 320', () => {
    const deep = suggestMixes(wall({ width: 6000, wallRow: 'always', wallDepth: 350 }));
    expect(deep.mixes.length).toBeGreaterThan(0);
    for (const m of deep.mixes) {
      const row = m.model.pieces.filter(
        (p) => p.item.placement?.kind !== 'floor' && !isTop(p.item.design.name),
      );
      expect(row.length).toBeGreaterThan(0);
      // The carcass depth; the doors stand in front of it.
      for (const p of row) expect(depthOf(p)).toBe(350);
      for (const p of row)
        for (const side of buildModel(p.item.design).panels.filter((x) => x.role === 'side'))
          expect(side.box.d).toBe(350);
      expect(m.model.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    }
    for (const p of suggestMixes(wall({ wallRow: 'always' })).mixes[0].model.pieces.filter(
      (x) => x.item.placement?.kind !== 'floor' && !isTop(x.item.design.name),
    ))
      expect(depthOf(p)).toBe(320);
  });
  it('a wrong tall height or wall depth is a checkWall error naming its field', () => {
    const r = checkWall({
      ...wall(),
      tallHeight: Number('abc'),
      wallDepth: 'abc' as unknown as number,
    });
    expect(r.map((d) => [d.field, d.severity, d.message])).toEqual([
      ['tallHeight', 'error', 'Tall cabinet height must be a whole number of mm above 0.'],
      ['wallDepth', 'error', 'Wall cabinet depth must be a whole number of mm above 0.'],
    ]);
    for (const bad of [{ tallHeight: 0 }, { wallDepth: -5 }, { wallDepth: 300.5 }]) {
      const s = suggestMixes(wall(bad));
      expect(s.mixes).toEqual([]);
      expect(s.problems.some((p) => p.severity === 'error')).toBe(true);
    }
  });
});

describe('a width per base kind (ADR-204)', () => {
  it('2000 mm, 3 pieces, no tall: an 800 drawer base beside 600 bases, ranked after the shared width', () => {
    const r = suggestMixes(wall({ width: 2000, pieces: 3, tallCount: 0, wallRow: 'never' }), 60);
    const shared = r.mixes.findIndex((m) => new Set(m.slots.map((s) => s.width)).size <= 2);
    expect(shared).toBe(0);
    expect(r.mixes[0].slots.map((s) => s.width).sort()).toEqual([666, 667, 667]);
    const i = r.mixes.findIndex(
      (m) =>
        m.slots.some((s) => s.kind === 'drawers' && s.width === 800) &&
        m.slots.filter((s) => s.kind !== 'drawers').every((s) => s.width === 600),
    );
    expect(i).toBeGreaterThan(shared);
    const mix = r.mixes[i];
    expect(sum(mix.slots.map((s) => s.width))).toBe(2000);
    expect(mix.model.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    // The swap is a separate card: the signature names each kind's width.
    const swap = r.mixes.findIndex(
      (m) =>
        m.slots.some((s) => s.kind === 'shelves' && s.width === 800) &&
        m.slots.filter((s) => s.kind !== 'shelves').every((s) => s.width === 600),
    );
    expect(swap).toBeGreaterThan(0);
    expect(r.mixes[swap].key).not.toBe(mix.key);
    expect(new Set(r.mixes.map((m) => m.key)).size).toBe(r.mixes.length);
  });
  it('the first 4 mixes of the 3000 mm default are unchanged', () => {
    expect(suggestMixes(wall()).mixes.map((m) => [m.key, m.summary])).toEqual([
      [
        '1|600,600,600,600,600|wall',
        '1 tall, 2 open shelves, 1 drawers, 1 door + shelves; wall row: 4 wall cabinets + top box',
      ],
      [
        '1|500,500,500,500,500,500|wall',
        '1 tall, 3 open shelves, 1 drawers, 1 door + shelves; wall row: 5 wall cabinets + top box',
      ],
      [
        '1|750,750,750,750|wall',
        '1 tall, 1 open shelves, 1 drawers, 1 door + shelves; wall row: 3 wall cabinets + top box',
      ],
      [
        '1|1000,1000,1000|wall',
        '1 tall, 1 open shelves, 1 drawers; wall row: 4 wall cabinets + top box',
      ],
    ]);
  });
  it('a 6000 mm wall stays capped at MAX_CANDIDATES, says so, and is answered quickly', () => {
    const report = { capped: false };
    expect(candidates(wall({ width: 6000 }), report).length).toBeLessThanOrEqual(MAX_CANDIDATES);
    expect(report.capped).toBe(true);
    const t0 = performance.now();
    const r = suggestMixes(wall({ width: 6000 }));
    expect(performance.now() - t0).toBeLessThan(3000);
    expect(r.mixes).toHaveLength(MIXES_FIRST);
    const note = r.problems.find((p) => p.code === 'wall-capped')!;
    // Reported like MAX_PIECES ('wall-many'): a note on the result, never an error.
    expect(note.severity).toBe('warning');
    expect(note.message).toMatch(new RegExp(`More than ${MAX_CANDIDATES} ways fill this wall`));
    expect(suggestMixes(wall()).problems.map((p) => p.code)).not.toContain('wall-capped');
  });
});

describe('carcasses of 3 or 4 equal fronts (ADR-204)', () => {
  it('Equal fronts 6 on 1000 mm: two 3-front carcasses of 3 bays, one door each, doors within 1 mm', () => {
    const r = suggestMixes(
      wall({ width: 1000, equalFronts: 6, tallCount: 0, wallRow: 'never' }),
      20,
    );
    expect(r.mixes).toHaveLength(1);
    const m = r.mixes[0];
    expect(m.slots).toEqual([
      { kind: 'door', width: 500, fronts: 3 },
      { kind: 'door', width: 500, fronts: 3 },
    ]);
    expect(m.model.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    for (const item of m.model.pieces.map((p) => p.item)) {
      const model = buildModel(item.design);
      expect(model.panels.filter((p) => p.role === 'door')).toHaveLength(3);
      expect(model.panels.filter((p) => p.role === 'divider')).toHaveLength(2);
      expect(model.panels.some((p) => p.role === 'shelf' || p.role === 'drawer-front')).toBe(false);
    }
    const ws = m.model.model.panels.filter((p) => p.role === 'door').map((d) => d.box.w);
    expect(ws).toHaveLength(6);
    expect(Math.max(...ws) - Math.min(...ws)).toBeLessThanOrEqual(1);
  });
  it('4-front carcasses too; a tall one has both halves split; the 1-and-2 groups come first', () => {
    expect(frontGroups(12)).toContainEqual([3, 3, 3, 3]);
    expect(frontGroups(12)).toContainEqual([4, 4, 4]);
    // 4s in the middle, 3s at both ends.
    expect(frontGroups(10)).toContainEqual([3, 4, 3]);
    const groups = frontGroups(8);
    const firstBig = groups.findIndex((g) => g.some((k) => k > 2));
    expect(groups.slice(0, firstBig).every((g) => g.every((k) => k <= 2))).toBe(true);
    expect(groups).toContainEqual([4, 4]);
    const r = suggestMixes(
      wall({ width: 1600, equalFronts: 8, tallCount: 1, wallRow: 'never' }),
      20,
    );
    const four = r.mixes.find((m) => m.slots.some((s) => s.kind === 'tall' && s.fronts === 4));
    expect(four).toBeTruthy();
    const tallItem = four!.model.pieces.find((p) => p.item.design.name.startsWith('Tall'))!.item;
    expect(buildModel(tallItem.design).panels.filter((p) => p.role === 'door')).toHaveLength(8);
    for (const m of r.mixes) {
      const ws = m.model.model.panels.filter((p) => p.role === 'door').map((d) => d.box.w);
      expect(Math.max(...ws) - Math.min(...ws)).toBeLessThanOrEqual(1);
    }
  });
  it('the empty-result note names carcasses of 1 to 4 fronts', () => {
    // 30 fronts of 100 mm: 4 fronts would fit, but 30 is no sum of 4s; every grouping has a 300 mm carcass of 3.
    const r = suggestMixes(wall({ equalFronts: 30, tallCount: 0 }));
    expect(r.mixes).toEqual([]);
    expect(r.problems.map((p) => p.message).join('\n')).toMatch(
      /no carcass of 1 to 4 fronts is between 400 and 1200 mm/,
    );
  });
});

describe('checkWall fields (ADR-193)', () => {
  it('each problem names the answer it is about, so the wizard can mark that field', () => {
    const r = checkWall({
      width: Number('abc'),
      depth: 560,
      height: 2400,
      minWidth: 800,
      maxWidth: 600,
      tallCount: -1,
    });
    expect(r.map((d) => [d.field, d.message])).toEqual([
      ['width', 'Width must be a whole number of mm above 0.'],
      ['minWidth', 'Min piece width 800 mm is more than the max, 600 mm.'],
      ['tallCount', 'Tall cabinets must be 0 or more.'],
    ]);
    expect(r.every((d) => d.severity === 'error')).toBe(true);
  });
});

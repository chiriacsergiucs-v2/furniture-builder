/**
 * Fill a wall (ADR-103): mixes fill the wall exactly, stay in the width range, carry no errors, follow Refine, avoid
 * sagging shelves with a centre divider, and equal fronts give equal doors. Includes a seeded fuzz run
 * (FUZZ_N=2000 pnpm exec vitest run tests/wallfill.test.ts for a deeper one).
 */
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { RULE_DEFAULTS } from '../src/core/rules';
import {
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
    const r = suggestMixes(wall());
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
    const any = suggestMixes(wall({ height: 1400 }));
    expect(any.mixes.length).toBeGreaterThan(0);
    expect(any.mixes.every((m) => !m.wall)).toBe(true);
    expect(any.problems.some((p) => p.code === 'wall-row-low')).toBe(true);
  });

  it('any shows mixes with and without a wall row; never shows none', () => {
    const any = suggestMixes(wall());
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
      };
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

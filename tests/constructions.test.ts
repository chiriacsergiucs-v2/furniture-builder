import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { cutlist, lengthsList } from '../src/core/cutlist';
import { defaultHandlePosition } from '../src/core/cabinet';
import {
  cabinet,
  cabinetDefaults,
  cornerDefaults,
  fr,
  frameDefaults,
  mm,
  newId,
  panelDefaults,
  templates,
  validateDesign,
  wrap,
} from '../src/core/design';
import { setLang } from '../src/core/i18n';
import { nestingJobs } from '../src/core/nesting/fromDesign';
import { overlaps } from '../src/core/geometry';
import type {
  CabinetParams,
  CornerParams,
  Design,
  FrameParams,
  Space,
  SplitSize,
} from '../src/core/types';

const noOverlaps = (d: Design) => {
  const P = buildModel(d).panels;
  for (let i = 0; i < P.length; i++)
    for (let j = i + 1; j < P.length; j++)
      expect(overlaps(P[i].box, P[j].box), `${P[i].id} × ${P[j].id}`).toBe(false);
};
const errors = (d: Design) => buildModel(d).diagnostics.filter((x) => x.severity === 'error');
const codes = (d: Design) => buildModel(d).diagnostics.map((x) => x.code);
const cab = (
  over: Partial<CabinetParams>,
  interior: Space = { id: 'in', kind: 'shelves', count: 1 },
) => cabinet('T', over, interior);
const frame = (kind: FrameParams['kind'], over: Partial<FrameParams> = {}) =>
  wrap('F', { kind: 'frame', id: 'F', params: { ...frameDefaults(kind), ...over } });

describe('kitchen construction flags (ADR-036)', () => {
  it('rails instead of a top: two rails, no top panel, nothing overlaps', () => {
    const d = cab({
      width: 800,
      height: 720,
      depth: 560,
      topKind: 'rails',
      railDepth: 100,
      back: 'none',
    });
    const m = buildModel(d);
    expect(m.panels.filter((p) => p.role === 'top')).toHaveLength(0);
    const rails = m.panels.filter((p) => p.role === 'rail');
    expect(rails).toHaveLength(2);
    expect(rails.every((r) => r.box.d === 100)).toBe(true);
    expect(errors(d)).toEqual([]);
    noOverlaps(d);
  });
  it('rails too deep for the carcass are an error, never a throw', () => {
    expect(codes(cab({ depth: 300, topKind: 'rails', railDepth: 200 }))).toContain('rail-depth');
  });
  it('no bottom: the opening runs down to the plinth, and a floor unit gets a warning', () => {
    const wall = cab({ mount: 'wall', bottom: 'none', plinthHeight: 0 });
    expect(buildModel(wall).panels.some((p) => p.role === 'bottom')).toBe(false);
    expect(buildModel(wall).spaces[0].box.y).toBe(0);
    expect(codes(wall)).not.toContain('no-bottom');
    expect(codes(cab({ bottom: 'none' }))).toContain('no-bottom');
    noOverlaps(wall);
  });
  it('an appliance niche that does not fit is an error; one that fits is scheduled with its entered size', () => {
    // A 3 mm back, so the 550 mm deep oven fits the 560 mm unit (the default back is PAL 18, ADR-164).
    const fits = cab(
      { width: 600, height: 720, depth: 560, backMaterialId: 'hdf3' },
      { id: 'n', kind: 'empty', appliance: { kind: 'oven', w: 560, h: 590, d: 550 } },
    );
    expect(codes(fits)).not.toContain('appliance-fit');
    expect(buildModel(fits).hardware.find((h) => h.kind === 'appliance')?.note).toContain(
      '560×590×550',
    );
    const tooBig = cab(
      { width: 600, height: 720, depth: 560 },
      { id: 'n', kind: 'empty', appliance: { kind: 'oven', w: 590, h: 590, d: 550 } },
    );
    expect(codes(tooBig)).toContain('appliance-fit');
  });
  it('a front-only panel is one part with a fixing-kit line and no carcass', () => {
    const d = wrap('DW', { kind: 'panel', id: 'P', params: panelDefaults('dishwasher') });
    const m = buildModel(d);
    expect(m.panels).toHaveLength(1);
    expect(m.hardware.map((h) => h.kind)).toContain('front-fixing');
    expect(validateDesign(d)).toEqual([]);
    expect(cutlist(m, d.materials)).toHaveLength(1);
  });
});

describe('sliding doors and flaps (ADR-037)', () => {
  const sliding = (count: 2 | 3 | 4, overlap = 30) =>
    cab(
      { width: 1800, height: 2100, depth: 600 },
      {
        id: 's',
        kind: 'hanging',
        railDrop: 60,
        front: { kind: 'sliding', count, overlap, track: 80 },
      },
    );
  it('doors cover the front zone exactly with the stated overlaps, in two planes, with no hinges', () => {
    for (const n of [2, 3, 4] as const) {
      const d = sliding(n);
      const m = buildModel(d);
      const doors = m.panels.filter((p) => p.role === 'door').sort((a, b) => a.box.x - b.box.x);
      expect(doors).toHaveLength(n);
      const g = d.product.kind === 'cabinet' ? d.product.params.frontGap : 0;
      expect(doors[0].box.x).toBe(Math.floor(g / 2));
      expect(doors[n - 1].box.x + doors[n - 1].box.w).toBe(1800 - Math.floor(g / 2));
      for (let i = 1; i < n; i++)
        expect(doors[i - 1].box.x + doors[i - 1].box.w - doors[i].box.x).toBe(30);
      expect(new Set(doors.map((p) => p.box.z)).size).toBe(2);
      expect(m.hardware.some((h) => h.kind === 'hinge')).toBe(false);
      expect(m.hardware.find((h) => h.kind === 'sliding-track')?.note).toContain('datasheet');
      expect(errors(d)).toEqual([]);
      noOverlaps(d);
    }
  });
  it('a track too shallow for two planes is an error', () => {
    const d = cab(
      {},
      { id: 's', kind: 'shelves', count: 1, front: { kind: 'sliding', count: 2, track: 20 } },
    );
    expect(codes(d)).toContain('sliding-track');
  });
  it('a flap schedules its stay and warns until the fitting is named', () => {
    const open = cab(
      { width: 800, height: 400, depth: 320, mount: 'wall' },
      { id: 'f', kind: 'shelves', count: 0, front: { kind: 'flap', count: 1, direction: 'up' } },
    );
    expect(codes(open)).toContain('flap-fitting');
    expect(buildModel(open).hardware.some((h) => h.kind === 'flap-stay')).toBe(true);
    const named = cab(
      { width: 800, height: 400, depth: 320, mount: 'wall' },
      {
        id: 'f',
        kind: 'shelves',
        count: 0,
        front: { kind: 'flap', count: 1, direction: 'up', fitting: 'My lift system' },
      },
    );
    expect(codes(named)).not.toContain('flap-fitting');
  });
  it('validation accepts the new fronts and rejects nonsense', () => {
    expect(validateDesign(sliding(3))).toEqual([]);
    const bad = cab(
      {},
      { id: 'x', kind: 'shelves', count: 1, front: { kind: 'sliding', count: 7 } as never },
    );
    expect(validateDesign(bad)).toContain('Invalid doors');
  });
});

describe('frame root and solid stock (ADR-038)', () => {
  it('every frame kind builds without errors or overlaps at its default size', () => {
    for (const k of ['table', 'bench', 'stool', 'chair', 'bed'] as const) {
      const d = frame(k);
      expect(validateDesign(d), k).toEqual([]);
      expect(errors(d), k).toEqual([]);
      noOverlaps(d);
    }
  });
  it('a wide bed gets a centre rail on legs; a narrow one does not', () => {
    const wide = buildModel(frame('bed'));
    expect(wide.panels.some((p) => p.label === 'Centre rail')).toBe(true);
    expect(wide.panels.filter((p) => p.label === 'Centre leg')).toHaveLength(2);
    const narrow = frame('bed', {
      bed: { ...frameDefaults('bed').bed!, mattress: { w: 900, l: 2000 } },
    });
    expect(buildModel(narrow).panels.some((p) => p.label === 'Centre rail')).toBe(false);
  });
  it('a bunk bed has two decks, guard rails, a ladder and a permanent safety warning', () => {
    const d = frame('bed', {
      bed: { ...frameDefaults('bed').bed!, mattress: { w: 900, l: 2000 }, tierGap: 900 },
    });
    const m = buildModel(d);
    expect(m.panels.filter((p) => p.role === 'slat').length).toBeGreaterThan(20);
    expect(m.panels.some((p) => p.label === 'Guard rail left')).toBe(true);
    expect(m.panels.some((p) => p.role === 'rung')).toBe(true);
    expect(codes(d)).toContain('safety-not-checked');
    expect(errors(d)).toEqual([]);
    noOverlaps(d);
  });
  it('solid parts never reach the sheet layout and appear in the lengths list', () => {
    const d = frame('table');
    const m = buildModel(d);
    const { jobs, rows } = nestingJobs(d, m);
    expect(rows.some((r) => r.solid)).toBe(true);
    expect(
      jobs.every((j) => d.materials.find((x) => x.id === j.materialId)?.stock !== 'solid'),
    ).toBe(true);
    const lists = lengthsList(
      rows,
      (id) => d.materials.find((x) => x.id === id)?.lengths ?? [2400],
      4,
    );
    const legs = rows.filter((r) => r.solid).reduce((n, r) => n + r.quantity, 0);
    expect(
      lists.reduce(
        (n, g) => n + g.bars.reduce((k, b) => k + b.parts.length, 0) + g.tooLong.length,
        0,
      ),
    ).toBe(legs);
    for (const g of lists)
      for (const b of g.bars)
        expect(b.parts.reduce((s, p) => s + p.length, 0) + (b.parts.length - 1) * 4 + b.waste).toBe(
          b.stock,
        );
  });
  it('a part longer than any stocked length is reported, not dropped', () => {
    const d = frame('table', { width: 2800 });
    const { rows } = nestingJobs(d, buildModel(d));
    const lists = lengthsList(rows, () => [2400], 4);
    expect(lists.some((g) => g.tooLong.length > 0)).toBe(true);
  });
  it('a slatted top without rails is an error, never a throw', () => {
    expect(codes(frame('bench', { top: 'slats', apron: { height: 0, thickness: 22 } }))).toContain(
      'slats-need-rails',
    );
  });
});

describe('rules registry (ADR-035)', () => {
  it('shelf span warns on a long shelf, scaled by thickness, and stays quiet within the limit', () => {
    expect(codes(cab({ width: 1200 }, { id: 'sh', kind: 'shelves', count: 2 }))).toContain(
      'shelf-span',
    );
    expect(codes(cab({ width: 800 }, { id: 'sh', kind: 'shelves', count: 2 }))).not.toContain(
      'shelf-span',
    );
    const tuned = {
      ...cab({ width: 1200 }, { id: 'sh', kind: 'shelves', count: 2 }),
      settings: { rules: { shelfSpan: 1200 } },
    };
    expect(codes(tuned)).not.toContain('shelf-span');
  });
  it('a wide hinged door warns; the message says typical', () => {
    const d = cab(
      { width: 800 },
      { id: 'dd', kind: 'shelves', count: 1, front: { kind: 'doors', count: 1 } },
    );
    const w = buildModel(d).diagnostics.find((x) => x.code === 'door-wide');
    expect(w?.message).toContain('typical');
  });
  it('tall floor storage gets an anti-tip fixing line, wall units do not', () => {
    expect(buildModel(cab({ height: 2000 })).hardware.some((h) => h.kind === 'wall-fixing')).toBe(
      true,
    );
    expect(
      buildModel(cab({ height: 2000, mount: 'wall' })).hardware.some(
        (h) => h.kind === 'wall-fixing',
      ),
    ).toBe(false);
    expect(buildModel(cab({ height: 900 })).hardware.some((h) => h.kind === 'wall-fixing')).toBe(
      false,
    );
  });
  it('tilt-up runs only when a room height is set', () => {
    const tall = cab({ height: 2400, depth: 600 });
    expect(codes(tall)).not.toContain('tilt-up');
    expect(codes({ ...tall, settings: { rules: { roomHeight: 2450 } } })).toContain('tilt-up');
  });
  it('hardware to choose stays a warning until cleared; rule settings are validated', () => {
    const d = { ...cab({}), catalog: { hardwareToChoose: 'pull-out frame' } };
    expect(codes(d)).toContain('hardware-to-choose');
    expect(validateDesign({ ...cab({}), settings: { rules: { shelfSpan: -3 } } })).toContain(
      'Invalid rule setting shelfSpan',
    );
  });
  it('no rule ever produces an error', () => {
    const d = cab(
      { width: 3000, height: 2400 },
      { id: 'a', kind: 'shelves', count: 3, front: { kind: 'doors', count: 1 } },
    );
    const m = buildModel({
      ...d,
      settings: { rules: { roomHeight: 1000 } },
      catalog: { hardwareToChoose: 'x' },
    });
    const ruleCodes = new Set([
      'shelf-span',
      'door-wide',
      'hanging-shallow',
      'tilt-up',
      'hardware-to-choose',
      'slat-gap',
      'safety-not-checked',
      'frame-span',
    ]);
    expect(
      m.diagnostics.filter((x) => ruleCodes.has(x.code)).every((x) => x.severity === 'warning'),
    ).toBe(true);
  });
});

describe('catalog metadata in the design (ADR-028)', () => {
  const withMeta = (catalog: unknown) => ({ ...cab({}), catalog }) as Design;
  it('absent is valid; good metadata is valid; bad values are reported, never thrown', () => {
    expect(validateDesign(cab({}))).toEqual([]);
    expect(
      validateDesign(
        withMeta({
          category: 'Wardrobe',
          origin: {
            catalogId: 'wardrobe',
            variantId: 'v1',
            revision: 1,
            productName: 'Wardrobe',
            takenAt: '2026-10-23T00:00:00Z',
          },
        }),
      ),
    ).toEqual([]);
    expect(
      validateDesign(
        withMeta({ origin: { catalogId: 'x', revision: 1.5, productName: 'X', takenAt: 't' } }),
      ),
    ).toContain('Invalid catalog origin');
    expect(
      validateDesign(
        withMeta({
          origin: {
            catalogId: 'x',
            revision: 1,
            productName: 'X',
            takenAt: 't',
            sourceUrl: 'javascript:alert(1)',
          },
        }),
      ),
    ).toContain('Catalog source link must be an http(s) address');
    expect(validateDesign(withMeta('nope'))).toContain('Invalid catalog metadata');
  });
  it('every existing default still validates unchanged', () => {
    expect(validateDesign(cabinet('X', {}, { id: newId(), kind: 'empty' }))).toEqual([]);
    expect(
      validateDesign(
        wrap('C', {
          kind: 'cabinet',
          id: 'c',
          params: cabinetDefaults({ id: 'i', kind: 'empty' }),
        }),
      ),
    ).toEqual([]);
  });
});

describe('doubled top (ADR-105)', () => {
  const tops = (d: Design) => buildModel(d).panels.filter((p) => p.role === 'top');
  for (const top of ['over', 'between'] as const)
    it(`top ${top}: two top panels under H, outer height and side joints kept, opening one panel lower`, () => {
      const single = cab({ top, height: 720 });
      const d = cab({ top, height: 720, topLayers: 2 });
      const [a, b] = tops(d);
      const t = a.box.h;
      expect(tops(d)).toHaveLength(2);
      expect(Math.max(a.box.y, b.box.y) + t).toBe(tops(single)[0].box.y + t);
      expect(Math.min(a.box.y, b.box.y)).toBe(tops(single)[0].box.y - t);
      expect({ ...a.box, y: 0 }).toEqual({ ...b.box, y: 0 });
      expect(a.banded).toEqual(b.banded);
      expect(buildModel(d).spaces[0].box.h).toBe(buildModel(single).spaces[0].box.h - t);
      expect(errors(d)).toEqual([]);
      noOverlaps(d);
    });
  it('half overlay: the front line drops one full panel, half over the lower layer', () => {
    const doorTop = (d: Design) =>
      Math.max(
        ...buildModel(d)
          .panels.filter((p) => p.role === 'door')
          .map((p) => p.box.y + p.box.h),
      );
    const door: Space = { id: 'in', kind: 'shelves', count: 1, front: { kind: 'doors', count: 1 } };
    const single = cab({ frontStyle: 'half' }, door);
    const d = cab({ frontStyle: 'half', topLayers: 2 }, door);
    const t = tops(d)[0].box.h;
    expect(Number.isFinite(doorTop(single))).toBe(true);
    expect(doorTop(d)).toBe(doorTop(single) - t);
    expect(errors(d)).toEqual([]);
  });
  it('the cut list shows one Top row with quantity 2', () => {
    const d = cab({ topLayers: 2 });
    const rows = cutlist(buildModel(d), d.materials).filter((r) => r.labels.includes('Top'));
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(2);
  });
  it('a rails top stays single and warns; an invalid value fails validation', () => {
    const d = cab({ topKind: 'rails', back: 'none', topLayers: 2 });
    expect(buildModel(d).panels.filter((p) => p.role === 'rail')).toHaveLength(2);
    expect(codes(d)).toContain('top-layers-rails');
    expect(codes(cab({ topLayers: 2 }))).not.toContain('top-layers-rails');
    const bad = cab({ topLayers: 3 as unknown as 2 });
    expect(validateDesign(bad)).toContain('topLayers must be 1 or 2');
  });
  it('corner cabinets double their top too', () => {
    for (const v of ['blind', 'l-shape', 'diagonal'] as const) {
      const one = wrap('C', { kind: 'corner', id: 'C', params: cornerDefaults(v) });
      const two = wrap('C', {
        kind: 'corner',
        id: 'C',
        params: { ...cornerDefaults(v), topLayers: 2 },
      });
      expect(tops(two).length, v).toBe(2 * tops(one).length);
      expect(errors(two), v).toEqual([]);
      noOverlaps(two);
    }
  });
});

describe('build only what the user set, and say why a part cannot be built (ADR-196)', () => {
  const corner = (over: Partial<CornerParams>, variant: CornerParams['variant'] = 'diagonal') =>
    wrap('C', { kind: 'corner', id: 'C', params: { ...cornerDefaults(variant), ...over } });
  const bar = { kind: 'bar' as const, holeSpacing: 128 };
  const message = (d: Design, code: string) =>
    buildModel(d).diagnostics.find((x) => x.code === code)?.message;

  it('1. a diagonal corner drills and schedules its bar handle; adjustable shelves there are an error', () => {
    const door = (side: 'left' | 'right', count: 1 | 2 = 1) =>
      corner({
        side,
        interior: {
          id: 'i',
          kind: 'shelves',
          count: 1,
          front: { kind: 'doors', count },
          handle: bar,
        },
      });
    const l = buildModel(door('left'));
    expect(l.diagnostics.filter((x) => x.severity === 'error')).toEqual([]);
    const leaf = l.panels.find((p) => p.role === 'door')!;
    // 479 × 618 mm leaf hinged left: the bar upright 40 mm from the right (opening) edge, centred on the height.
    expect([leaf.box.w, leaf.box.h]).toEqual([479, 618]);
    expect(leaf.handleHoles).toEqual({
      at: [
        [439, 245],
        [439, 373],
      ],
      diameter: 5,
    });
    expect(l.hardware.find((h) => h.kind === 'handle')).toMatchObject({
      nodeId: 'i',
      label: 'Bar handle, 128 mm centres',
      quantity: 1,
    });
    // Mirrored for a corner on the right: the holes move to the other edge with the door.
    const r = buildModel(door('right'));
    expect(r.panels.find((p) => p.role === 'door')!.handleHoles?.at.map(([u]) => u)).toEqual([
      40, 40,
    ]);
    // A pair: one bar on each meeting edge, two handles scheduled.
    const pair = buildModel(door('left', 2));
    expect(pair.panels.filter((p) => p.role === 'door' && p.handleHoles)).toHaveLength(2);
    expect(pair.hardware.find((h) => h.kind === 'handle')?.quantity).toBe(2);

    const adj = corner({
      interior: { id: 'i', kind: 'shelves', count: 2, adjustable: true, front: null },
    });
    const m = buildModel(adj);
    expect(m.diagnostics.find((x) => x.code === 'diagonal-adjustable')).toMatchObject({
      severity: 'error',
      nodeId: 'i',
      message: 'A diagonal corner has no straight sides for shelf pins; make the shelves fixed.',
    });
    // The shelves stay in the drawing behind the blocking error, as in an L-corner's open wing; no supports scheduled.
    expect(m.panels.filter((p) => p.role === 'shelf')).toHaveLength(2);
    expect(m.hardware.some((h) => h.kind === 'shelf-pin')).toBe(false);
    // Fixed shelves build as before.
    const fixed = buildModel(corner({ interior: { id: 'i', kind: 'shelves', count: 2 } }));
    expect(fixed.panels.filter((p) => p.role === 'shelf')).toHaveLength(2);
    expect(fixed.diagnostics.map((x) => x.code)).not.toContain('diagonal-adjustable');
  });

  it('2. back slats are never clamped: too many is an error and nothing overlaps; 4 build as before', () => {
    const chair = (count: number) =>
      frame('chair', {
        back: { seatHeight: 460, style: 'slats', count, railHeight: 60, angleDeg: 0 },
      });
    const crowded = chair(10);
    expect(message(crowded, 'back-slats-crowded')).toBe(
      '10 back slats of 40 mm do not fit between the posts (370 mm); at most 6 fit.',
    );
    expect(errors(crowded).map((x) => x.code)).toEqual(['back-slats-crowded']);
    expect(buildModel(crowded).panels.filter((p) => p.label === 'Back slat')).toHaveLength(0);
    noOverlaps(crowded);
    for (const n of [4, 6]) {
      const ok = chair(n);
      expect(buildModel(ok).panels.filter((p) => p.label === 'Back slat')).toHaveLength(n);
      expect(errors(ok)).toEqual([]);
      noOverlaps(ok);
    }
  });

  it('3. a flap bar sits 40 mm from its free edge, centred; an explicit position wins', () => {
    const flap = (direction: 'up' | 'down', position?: 'top' | 'centre' | 'bottom') =>
      cab(
        {},
        {
          id: 'f',
          kind: 'shelves',
          count: 0,
          front: { kind: 'flap', count: 1, direction, fitting: 'X' },
          handle: position ? { ...bar, position } : bar,
        },
      );
    const holes = (d: Design) => buildModel(d).panels.find((p) => p.role === 'door')!;
    const up = holes(flap('up'));
    expect([up.box.w, up.box.h]).toEqual([798, 818]);
    expect(up.handleHoles?.at).toEqual([
      [335, 40],
      [463, 40],
    ]);
    expect(holes(flap('down')).handleHoles?.at).toEqual([
      [335, 778],
      [463, 778],
    ]);
    expect(holes(flap('up', 'top')).handleHoles?.at).toEqual([
      [335, 778],
      [463, 778],
    ]);
    expect(holes(flap('down', 'centre')).handleHoles?.at).toEqual([
      [335, 409],
      [463, 409],
    ]);
    expect(defaultHandlePosition({ kind: 'flap', count: 1, direction: 'up' })).toBe('bottom');
    expect(defaultHandlePosition({ kind: 'flap', count: 1, direction: 'down' })).toBe('top');
    expect(defaultHandlePosition({ kind: 'doors', count: 1 })).toBe('centre');
    expect(defaultHandlePosition(null)).toBe('top');
  });

  it('4. a gap wider than the front zone builds no front and names gap and zone; no negative size anywhere', () => {
    const fronts: Space[] = [
      { id: 's', kind: 'shelves', count: 1, front: { kind: 'doors', count: 1 } },
      { id: 's', kind: 'shelves', count: 1, front: { kind: 'doors', count: 2 } },
      { id: 's', kind: 'shelves', count: 0, front: { kind: 'sliding', count: 2 } },
      { id: 's', kind: 'shelves', count: 0, front: { kind: 'flap', count: 1, direction: 'up' } },
    ];
    for (const interior of fronts) {
      const d = cab({ width: 120, height: 200, depth: 150, frontGap: 150 }, interior);
      const m = buildModel(d);
      const gap = m.diagnostics.filter((x) => x.code === 'front-gap');
      expect(gap, interior.kind).toHaveLength(1);
      expect(gap[0]).toMatchObject({
        severity: 'error',
        message: 'The 150 mm gap leaves no room for fronts on 120×120 mm.',
      });
      expect(m.panels.filter((p) => p.role === 'door' || p.role === 'drawer-front')).toEqual([]);
      expect(m.diagnostics.map((x) => x.code)).not.toContain('door-small');
      for (const p of m.panels)
        expect(Math.min(p.box.w, p.box.h, p.box.d), p.id).toBeGreaterThan(0);
      for (const r of cutlist(m, d.materials))
        expect(Math.min(r.length, r.width), r.labels.join()).toBeGreaterThan(0);
    }
    // Drawer fronts: a gap of the cabinet's width leaves them none; the boxes are not built either.
    const chest = cab({ frontGap: 800 }, { id: 's', kind: 'drawers', count: 2 });
    expect(message(chest, 'front-gap')).toBe(
      'The 800 mm gap leaves no room for fronts on 800×820 mm.',
    );
    expect(buildModel(chest).panels.some((p) => p.role.startsWith('drawer'))).toBe(false);
    // Doors that only lose their room to the gap between them say so too.
    const pair = cab(
      { width: 200, frontGap: 190 },
      { id: 's', kind: 'shelves', count: 0, front: { kind: 'doors', count: 2 } },
    );
    expect(codes(pair)).toContain('front-gap');
    expect(buildModel(pair).panels.some((p) => p.role === 'door')).toBe(false);
    // With no gap at all the space alone is too small: a 1 mm inset part with a pair of doors.
    const tiny = cab(
      { frontStyle: 'inset', frontGap: 0 },
      {
        id: 'sp',
        kind: 'split',
        axis: 'x',
        sizes: [mm(1), fr()],
        children: [
          { id: 'a', kind: 'shelves', count: 0, front: { kind: 'doors', count: 2 } },
          { id: 'b', kind: 'shelves', count: 0 },
        ],
      },
    );
    expect(message(tiny, 'front-gap')).toMatch(/^There is no room for fronts on 1×\d+ mm\.$/);
    expect(buildModel(tiny).panels.some((p) => p.role === 'door')).toBe(false);
    // Corners: the diagonal doors and the blind panel.
    expect(message(corner({ frontGap: 1000 }), 'front-gap')).toBe(
      'The 1000 mm gap leaves no room for fronts on 481×620 mm.',
    );
    const blind = buildModel(corner({ frontGap: 700 }, 'blind'));
    expect(blind.panels.some((p) => p.role === 'blind-panel')).toBe(false);
    expect(blind.diagnostics.map((x) => x.code)).toContain('front-gap');
    // An ordinary gap builds fronts as before.
    expect(codes(cab({}, fronts[0]))).not.toContain('front-gap');
  });

  it('5. split-fit names what the parts ask, the room left after the dividers and the inside width', () => {
    const split = (sizes: SplitSize[]) =>
      cab(
        { width: 800 },
        {
          id: 'sp',
          kind: 'split',
          axis: 'x',
          sizes,
          children: sizes.map((_, i) => ({ id: `c${i}`, kind: 'shelves', count: 0 })),
        },
      );
    expect(message(split([mm(382), mm(382)]), 'split-fit')).toBe(
      'Parts need 764 mm but 746 mm is left after 1 divider of 18 mm (764 mm inside).',
    );
    expect(message(split([mm(300), mm(300), mm(300)]), 'split-fit')).toBe(
      'Parts need 900 mm but 728 mm is left after 2 dividers of 18 mm (764 mm inside).',
    );
    expect(message(split([fr(0.01), fr(1000)]), 'split-fit')).toBe(
      "Part 1's share is too small to give it any width.",
    );
    expect(codes(split([mm(373), fr()]))).not.toContain('split-fit');
  });

  it('6. an L-corner wing with no side at the corner: adjustable shelves are an error and no pins are scheduled', () => {
    const l = corner(
      { wingInterior: { id: 'w', kind: 'shelves', count: 2, adjustable: true, front: null } },
      'l-shape',
    );
    const m = buildModel(l);
    expect(m.diagnostics.find((x) => x.code === 'pin-rows-no-panel')).toMatchObject({
      severity: 'error',
      nodeId: 'w',
      message:
        'The side-wall wing has no side at the corner, so its shelves cannot rest on pins; make them fixed.',
    });
    expect(m.hardware.filter((h) => h.kind === 'shelf-pin' && h.nodeId === 'w')).toEqual([]);
    expect(m.panels.some((p) => p.pinRows?.length)).toBe(false);
    // Wing A has both sides: its adjustable shelves get pins as before.
    const a = buildModel(
      corner(
        {
          interior: {
            id: 'a',
            kind: 'shelves',
            count: 2,
            adjustable: true,
            front: { kind: 'doors', count: 1 },
          },
        },
        'l-shape',
      ),
    );
    expect(a.diagnostics.map((x) => x.code)).not.toContain('pin-rows-no-panel');
    expect(a.hardware.find((h) => h.kind === 'shelf-pin' && h.nodeId === 'a')?.quantity).toBe(8);
  });

  it('7. the blind corner template says the blind width it builds', () => {
    const t = templates.find((x) => x.id === 'corner-blind')!;
    const c = cornerDefaults('blind');
    expect(t.description).toBe(
      `${c.width} × ${c.height} × ${c.depth}, ${c.blindWidth} mm blind section on the left, one door`,
    );
    expect(t.description).toContain('610 mm blind section');
    const p = t.create().product;
    expect(p.kind === 'corner' && p.params.blindWidth).toBe(c.blindWidth);
  });

  it('8. drawer-low names front, slot, clearance and the smallest front that fits, with no resize warning', () => {
    const drawers = (first: number, second = 100) =>
      cab({}, { id: 'd', kind: 'drawers', count: 3, heights: [mm(first), mm(second), mm(100)] });
    const low = drawers(100);
    expect(message(low, 'drawer-low')).toBe(
      'Drawer 1 box would be only 54 mm high (front 100, slot 84, clearance 30 mm); give it a front of at least 106 mm.',
    );
    expect(codes(low)).not.toContain('drawer-heights-resized');
    // The front it names is enough: drawer 1 now builds; a middle drawer is named with its own numbers.
    expect(codes(drawers(106))).not.toContain('drawer-low');
    expect(codes(drawers(106))).toContain('drawer-heights-resized');
    expect(message(drawers(106, 50), 'drawer-low')).toBe(
      'Drawer 2 box would be only 23 mm high (front 50, slot 53, clearance 30 mm); give it a front of at least 87 mm.',
    );
    expect(codes(drawers(106, 87))).not.toContain('drawer-low');
    // Equal heights: the named front is the one that works once it is chosen for that drawer.
    const equal = cab({}, { id: 'd', kind: 'drawers', count: 12 });
    expect(message(equal, 'drawer-low')).toBe(
      'Drawer 1 box would be only 36 mm high (front 66, slot 66, clearance 30 mm); give it a front of at least 106 mm.',
    );
    const chosen = cab(
      {},
      {
        id: 'd',
        kind: 'drawers',
        count: 12,
        heights: [mm(106), ...Array.from({ length: 11 }, () => fr())],
      },
    );
    expect(message(chosen, 'drawer-low')).not.toMatch(/^Drawer 1 /);
    // Without an error the resize warning stays.
    expect(
      codes(cab({}, { id: 'd', kind: 'drawers', count: 2, heights: [mm(200), mm(200)] })),
    ).toContain('drawer-heights-resized');
  });

  it('every new text has its Russian entry', () => {
    const door: Space = { id: 's', kind: 'shelves', count: 1, front: { kind: 'doors', count: 1 } };
    setLang('ru');
    try {
      expect(
        message(cab({ width: 120, height: 200, depth: 150, frontGap: 150 }, door), 'front-gap'),
      ).toBe('Зазор 150 мм не оставляет места для фасадов на 120×120 мм.');
      expect(
        message(
          frame('chair', {
            back: { seatHeight: 460, style: 'slats', count: 10, railHeight: 60, angleDeg: 0 },
          }),
          'back-slats-crowded',
        ),
      ).toMatch(/^10 реек спинки по 40 мм/);
    } finally {
      setLang('en');
    }
  });
});

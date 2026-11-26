// Highlights and the room Custom (ADR-298): highlighted versions, the two custom families and the stand-outs.
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { validateDesign } from '../src/core/design';
import { hasStagger } from '../src/core/stagger';
import { validateLocalTemplate } from '../src/core/catalog/local';
import {
  catalogFamilies,
  FUNCTIONS,
  insertable,
  insertVariant,
  ROOM_LABEL,
  ROOMS,
} from '../src/core/catalog';

const highlighted = catalogFamilies.flatMap((f) =>
  f.variants.filter((v) => v.highlight).map((v) => ({ f, v })),
);

describe('Highlights (ADR-298)', () => {
  it('has the room Custom, holding Room divider and Staggered shelving', () => {
    expect(ROOMS).toContain('custom');
    expect(ROOM_LABEL.custom).toBe('Custom');
    const custom = catalogFamilies.filter((f) => f.rooms[0] === 'custom').map((f) => f.id);
    expect(custom).toEqual(['room-divider', 'staggered-shelving']);
  });

  it('shows 3 distinct highlighted kit versions of each custom family', () => {
    for (const id of ['room-divider', 'staggered-shelving']) {
      const f = catalogFamilies.find((x) => x.id === id)!;
      const vs = f.variants.filter((v) => v.highlight);
      expect(vs).toHaveLength(3);
      expect(vs.every((v) => v.kit)).toBe(true);
      const looks = vs.map((v) => {
        const d = insertVariant(f, v)!;
        if (d.product.kind !== 'cabinet') throw Error('not a cabinet');
        const { width, height, depth } = d.product.params;
        return `${width}x${height}x${depth}`;
      });
      expect(new Set(looks).size).toBe(3);
    }
  });

  it('the divider is open both sides; the shelving has a back; both are staggered', () => {
    for (const { f, v } of highlighted.filter((x) => x.v.kit)) {
      const d = insertVariant(f, v)!;
      if (d.product.kind !== 'cabinet') throw Error('not a cabinet');
      expect(hasStagger(d.product), v.id).toBe(true);
      if (f.id === 'room-divider') expect(d.product.params.twoFaced, v.id).toBe(true);
      else expect(d.product.params.back, v.id).toBe('applied');
    }
  });

  it('every highlighted version inserts valid, with no error diagnostic', () => {
    expect(highlighted.length).toBeGreaterThanOrEqual(11);
    for (const { f, v } of highlighted) {
      expect(insertable(v), v.id).toBe(true);
      const d = insertVariant(f, v)!;
      expect(validateDesign(d), v.id).toEqual([]);
      const errors = buildModel(d).diagnostics.filter((x) => x.severity === 'error');
      expect(
        errors.map((e) => e.code),
        v.id,
      ).toEqual([]);
    }
  });

  it('has an insertable stand-out in every function group', () => {
    for (const fn of FUNCTIONS) {
      const ids = highlighted
        .filter((x) => x.f.function === fn && insertable(x.v))
        .map((x) => x.v.id);
      expect(ids.length, fn).toBeGreaterThan(0);
    }
    const standOuts = [
      'tall-drawer-tower',
      'media-wall',
      'dining-h-stretcher',
      'garden-bench-back',
      'daybed-three-sided',
    ];
    for (const id of standOuts)
      expect(
        highlighted.some((x) => x.v.id === id),
        id,
      ).toBe(true);
  });

  it("the user's own template may carry highlight, but only as true", () => {
    const f = catalogFamilies.find((x) => x.id === 'bookcase')!;
    const tpl = (highlight: unknown) => ({
      id: 'own-x',
      revision: 1,
      updatedAt: '2026-11-26T00:00:00Z',
      family: {
        ...f,
        id: 'own-x',
        variants: [{ id: 'a', name: 'A', summary: '', kind: 'interior', requires: [], highlight }],
      },
    });
    expect(validateLocalTemplate(tpl(true))).toEqual([]);
    expect(validateLocalTemplate(tpl(undefined))).toEqual([]);
    expect(validateLocalTemplate(tpl('yes')).map((p) => p.code)).toContain('bad-variant');
  });
});

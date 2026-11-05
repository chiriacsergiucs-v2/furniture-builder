// ADR-192: a drawer box without an inner front — the drawer front closes the box.
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { cabinet, defaultDrawers, makeSpace, validateDesign } from '../src/core/design';
import type { Design, DrawerSettings, Space } from '../src/core/types';

const chest = (drawers: Partial<DrawerSettings> = {}, front: Space['front'] = null): Design =>
  cabinet(
    'Chest',
    {
      width: 810,
      height: 785,
      depth: 412,
      plinthHeight: 0,
      drawers: { ...defaultDrawers(), ...drawers },
    },
    { ...makeSpace('drawers'), count: 4, front } as Space,
  );
const parts = (d: Design, role: string) => buildModel(d).panels.filter((p) => p.role === role);

describe('drawer boxes without an inner front (ADR-192)', () => {
  it('innerFront: false drops the inner fronts and keeps sides, backs and bottoms', () => {
    const on = chest(),
      off = chest({ innerFront: false });
    expect(parts(on, 'drawer-inner-front')).toHaveLength(4);
    expect(parts(off, 'drawer-inner-front')).toHaveLength(0);
    for (const role of ['drawer-side', 'drawer-back', 'drawer-bottom', 'drawer-front'])
      expect(parts(off, role).map((p) => p.box)).toEqual(parts(on, role).map((p) => p.box));
    expect(buildModel(off).diagnostics).toEqual([]);
  });

  it('absent innerFront gives the box with an inner front', () => {
    const d = chest();
    expect(d.product.kind === 'cabinet' && d.product.params.drawers.innerFront).toBeUndefined();
    expect(parts(d, 'drawer-inner-front')).toHaveLength(4);
  });

  it('drawers behind doors keep their inner front and warn', () => {
    const d = chest({ innerFront: false }, { kind: 'doors', count: 2 });
    expect(parts(d, 'drawer-inner-front')).toHaveLength(4);
    const w = buildModel(d).diagnostics.find((x) => x.code === 'inner-front-internal');
    expect(w?.severity).toBe('warning');
  });

  it('validateDesign rejects a non-boolean innerFront', () => {
    expect(validateDesign(chest({ innerFront: false }))).toEqual([]);
    const bad = chest();
    if (bad.product.kind === 'cabinet')
      (bad.product.params.drawers as unknown as Record<string, unknown>).innerFront = 'no';
    expect(validateDesign(bad)).toContain('Invalid drawer settings');
  });
});

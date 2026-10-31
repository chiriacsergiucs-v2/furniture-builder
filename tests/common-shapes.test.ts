// A common top or bottom across a gap, over corner units and desks (ADR-169).
import { describe, expect, it } from 'vitest';
import { commonPanelCheck } from '../src/core/common';
import { templates } from '../src/core/design';
import { footprint } from '../src/core/outline';
import { buildProjectModel, makeItem, newProject, type Project } from '../src/core/project';
import type { CabinetParams, Design, Panel } from '../src/core/types';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
type Turn = 0 | 90 | 180 | 270;
const at = (p: Project, d: Design, x: number, z: number, r: Turn = 0) => ({
  ...makeItem(p, d),
  position: { x, y: 0, z },
  rotationY: r,
});
const withCab = (d: Design, patch: Partial<CabinetParams>): Design =>
  d.product.kind === 'cabinet'
    ? { ...d, product: { ...d.product, params: { ...d.product.params, ...patch } } }
    : d;
const diagonal = (): Design => {
  const d = t('corner-l');
  return d.product.kind === 'corner'
    ? {
        ...d,
        product: {
          ...d.product,
          params: {
            ...d.product.params,
            variant: 'diagonal',
            interior: { id: 'i', kind: 'shelves', count: 1, front: { kind: 'doors', count: 1 } },
          },
        },
      }
    : d;
};
function project(items: ReturnType<typeof at>[], kind: 'top' | 'bottom' = 'top'): Project {
  const p = newProject('Shapes');
  return { ...p, items, common: [{ id: 'c', kind, itemIds: items.map((i) => i.id) }] };
}
const commons = (p: Project): Panel[] =>
  buildProjectModel(p).model.panels.filter((x) => x.id.startsWith('common:'));
const codes = (p: Project) => buildProjectModel(p).diagnostics.map((d) => d.code);
const errors = (p: Project) =>
  buildProjectModel(p).diagnostics.filter((d) => d.severity === 'error');
describe('common panel across gaps, corners and desks (ADR-169)', () => {
  it('two cabinets 600 mm apart: one top 600 + 600 + 600 wide, with the common-gap warning', () => {
    const p0 = newProject('Gap');
    const a = at(p0, t('base-door'), 0, 0),
      b = at(p0, t('base-door'), 1200, 0);
    const p = project([a, b]);
    const [top] = commons(p);
    expect(commons(p)).toHaveLength(1);
    expect([top.box.x, top.box.w]).toEqual([0, 1800]);
    expect(top.shape).toBeUndefined();
    expect(codes(p)).toContain('common-gap');
    const gap = buildProjectModel(p).diagnostics.find((d) => d.code === 'common-gap')!;
    expect(gap.severity).toBe('warning');
    expect(gap.message).toMatch(/600 mm gap/);
    expect(errors(p)).toEqual([]);
  });

  it('a blind corner with a cabinet on its wing: one plain top; an L corner with one on each wing: one shaped top', () => {
    const p0 = newProject('Corners');
    const blind = at(p0, t('corner-blind'), 0, 0),
      next = at(p0, t('base-door'), 1000, 0);
    const pb = project([blind, next]);
    const [plain] = commons(pb);
    expect(commons(pb)).toHaveLength(1);
    expect([plain.box.x, plain.box.w, plain.shape]).toEqual([0, 1600, undefined]);
    expect(errors(pb)).toEqual([]);
    const L = at(p0, t('corner-l'), 0, 0),
      back = at(p0, t('base-door'), 900, 0),
      side = at(p0, t('base-door'), 0, 900, 90);
    const pl = project([L, back, side]);
    const [shaped] = commons(pl);
    expect(commons(pl)).toHaveLength(1);
    expect(shaped.shape?.kind).toBe('profile');
    expect([shaped.box.w, shaped.box.d]).toEqual([1500, 1482]);
    // The outline covers both wings: an L (with the corner's own 18 mm step where its side-wall back stands).
    expect(footprint(shaped)).toEqual([
      [0, 18],
      [1500, 18],
      [1500, 560],
      [560, 560],
      [560, 1500],
      [18, 1500],
      [18, 560],
      [0, 560],
    ]);
    // No errors: the members do not overlap one another (pieces-overlap) and nothing else is wrong.
    expect(errors(pl)).toEqual([]);
    // Doors are checked against the top's pieces, not its enclosing outline: none hits the common top.
    expect(
      buildProjectModel(pl).diagnostics.filter((d) => /hits Common top/.test(d.message)),
    ).toEqual([]);
    const rows = buildProjectModel(pl).model.panels.filter((x) => x.role === 'top');
    expect(rows.map((x) => x.id)).toEqual(['common:c']);
  });

  it('a diagonal corner with a cabinet: its returns end under the common top; one shaped part', () => {
    const p0 = newProject('Diagonal');
    const d = at(p0, diagonal(), 0, 0),
      c = at(p0, t('base-door'), 900, 0);
    const p = project([d, c]);
    const [top] = commons(p);
    expect(top.shape?.kind).toBe('profile');
    const returns = buildProjectModel(p).model.panels.filter((x) =>
      x.label.startsWith('Side return'),
    );
    expect(returns.every((r) => r.box.y + r.box.h <= top.box.y)).toBe(true);
    expect(errors(p).filter((e) => e.code !== 'pieces-overlap')).toEqual([]);
  });

  it('a desk beside a cabinet of its height: one top over both, no worktop; Common bottom on the desk is refused', () => {
    const p0 = newProject('Desk');
    const desk = at(p0, t('desk-pedestal'), 0, 0);
    // A cabinet as high as the desk, standing against the desk's right end with the same back line.
    const cab = at(p0, withCab(t('base-door'), { height: 750, plinthHeight: 80 }), 1400, 0);
    const p = project([desk, cab]);
    expect(commonPanelCheck(p, [desk.id, cab.id], 'top').reason).toBeNull();
    const parts = buildProjectModel(p).model.panels;
    expect(parts.some((x) => x.role === 'worktop')).toBe(false);
    const [top] = commons(p);
    expect(top.box.x).toBe(0);
    expect(top.box.w).toBe(2000);
    // The desk keeps its pedestal's own top under the common top.
    expect(parts.some((x) => x.id.startsWith(`${desk.id}:`) && x.role === 'top')).toBe(true);
    expect(commonPanelCheck(p, [desk.id, cab.id], 'bottom').reason).toMatch(/has no bottom/);
    // Frames and panel sets stay out.
    const bed = makeItem(p, t('panels'));
    expect(
      commonPanelCheck({ ...p, items: [...p.items, bed] }, [desk.id, bed.id], 'top').reason,
    ).toMatch(/not a cabinet, corner unit or desk/);
  });
});

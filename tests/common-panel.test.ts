// A common top or bottom across touching items in a row (ADR-165).
import { describe, expect, it } from 'vitest';
import { commonPanelCheck, pruneCommon } from '../src/core/common';
import { templates } from '../src/core/design';
import {
  buildProjectModel,
  makeItem,
  newProject,
  PROJECT_SCHEMA,
  projectCutlist,
  validateProject,
  type Project,
} from '../src/core/project';
import { cutlist } from '../src/core/cutlist';
import type { CabinetParams, Design, Panel } from '../src/core/types';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const withCab = (d: Design, patch: Partial<CabinetParams>): Design =>
  d.product.kind === 'cabinet'
    ? { ...d, product: { ...d.product, params: { ...d.product.params, ...patch } } }
    : d;
/** Two base units side by side (the second placed at the first's right edge). */
function pair(a: Partial<CabinetParams> = {}, b: Partial<CabinetParams> = {}): Project {
  let p = newProject('Common');
  p = { ...p, items: [...p.items, makeItem(p, withCab(t('base-door'), a))] };
  p = { ...p, items: [...p.items, makeItem(p, withCab(t('base-door'), b))] };
  return p;
}
const linked = (p: Project, kind: 'top' | 'bottom' = 'top'): Project => ({
  ...p,
  common: [{ id: 'c1', kind, itemIds: p.items.map((i) => i.id) }],
});
const ofRole = (p: Project, role: string): Panel[] =>
  buildProjectModel(p).model.panels.filter((x) => x.role === role);
const codes = (p: Project) => buildProjectModel(p).diagnostics.map((d) => d.code);
const errors = (p: Project) =>
  buildProjectModel(p).diagnostics.filter((d) => d.severity === 'error');

describe('common top or bottom (ADR-165)', () => {
  it('two touching units: one top across both and no tops of their own; a bottom likewise', () => {
    const p = pair();
    const m = buildProjectModel(p);
    const [a, b] = m.pieces.map((pc) => pc.bounds);
    expect(a.x + a.w).toBe(b.x);
    const tops = ofRole(linked(p), 'top');
    expect(tops).toHaveLength(1);
    expect(tops[0].id).toBe('common:c1');
    expect(tops[0].label).toBe('Common top');
    expect(tops[0].box.w).toBe(a.w + b.w);
    expect(tops[0].box.x).toBe(a.x);
    expect(errors(linked(p))).toEqual([]);
    const rows = cutlist(
      buildProjectModel(linked(p)).model,
      buildProjectModel(linked(p)).materials,
    );
    expect(rows.find((r) => r.labels.includes('Common top'))?.quantity).toBe(1);
    // The outline is the same: the pieces do not move.
    expect(buildProjectModel(linked(p)).pieces.map((pc) => pc.bounds)).toEqual([a, b]);
    const bottoms = ofRole(linked(p, 'bottom'), 'bottom');
    expect(bottoms).toHaveLength(1);
    expect(bottoms[0].box.w).toBe(a.w + b.w);
    expect(errors(linked(p, 'bottom'))).toEqual([]);
  });

  it('a top between the sides is built over them while linked; doubled tops; a member moved out of line breaks the link', () => {
    const between = pair({ top: 'between' }, {});
    const top = ofRole(linked(between), 'top');
    expect(top).toHaveLength(1);
    expect(errors(linked(between))).toEqual([]);
    // Both doubled: two layers. A mix: one, with a warning.
    const both = linked(pair({ topLayers: 2 }, { topLayers: 2 }));
    expect(
      ofRole(both, 'top')
        .map((x) => x.id)
        .sort(),
    ).toEqual(['common:c1', 'common:c1/1']);
    expect(errors(both)).toEqual([]);
    const mixed = linked(pair({ topLayers: 2 }, {}));
    expect(ofRole(mixed, 'top')).toHaveLength(1);
    expect(codes(mixed)).toContain('common-top-layers');
    // Moved 10 mm forward, out of line (a gap along the row is bridged since ADR-169): not built, a warning, each
    // keeps its own top.
    const p = linked(pair());
    const moved = {
      ...p,
      items: p.items.map((it, i) =>
        i === 1
          ? { ...it, position: { ...it.position, x: it.position.x + 10, z: it.position.z + 10 } }
          : it,
      ),
    };
    expect(codes(moved)).toContain('common-panel-broken');
    expect(ofRole(moved, 'top')).toHaveLength(2);
    expect(ofRole(moved, 'top').some((x) => x.id.startsWith('common:'))).toBe(false);
  });

  it('commonPanelCheck refuses another height, depth, plinth, an item out of line, a turned item and a lower desk, with the reason', () => {
    const ids = (p: Project) => p.items.map((i) => i.id);
    const why = (p: Project) => commonPanelCheck(p, ids(p), 'top').reason;
    expect(why(pair())).toBeNull();
    expect(why(pair({}, { height: 700 }))).toMatch(/height/);
    expect(why(pair({}, { depth: 500 }))).toMatch(/depth/);
    expect(why(pair({}, { plinthHeight: 120 }))).toMatch(/height|plinth/);
    const p = pair();
    // A gap along the row is bridged (ADR-169); out of line is refused.
    const gap = {
      ...p,
      items: p.items.map((it, i) =>
        i === 1 ? { ...it, position: { ...it.position, x: it.position.x + 5 } } : it,
      ),
    };
    expect(why(gap)).toBeNull();
    const offLine = {
      ...p,
      items: p.items.map((it, i) =>
        i === 1
          ? { ...it, position: { ...it.position, x: it.position.x + 5, z: it.position.z + 5 } }
          : it,
      ),
    };
    expect(why(offLine)).toMatch(/does not touch/);
    const turned = {
      ...p,
      items: p.items.map((it, i) => (i === 1 ? { ...it, rotationY: 90 as const } : it)),
    };
    expect(why(turned)).not.toBeNull();
    let withDesk = newProject('Desk');
    withDesk = { ...withDesk, items: [makeItem(withDesk, t('base-door'))] };
    withDesk = { ...withDesk, items: [...withDesk.items, makeItem(withDesk, t('desk-pedestal'))] };
    // A desk may join since ADR-169, but this one is lower than the base unit.
    expect(why(withDesk)).toMatch(/height/);
    expect(commonPanelCheck(p, [ids(p)[0]], 'top').reason).toMatch(/two or more/);
  });

  it('the project parts list has one Common top and no tops of the members; an item counted twice is refused', () => {
    const p = linked(pair());
    const rows = projectCutlist(p);
    expect(rows.filter((r) => r.labels.includes('Common top')).map((r) => r.quantity)).toEqual([1]);
    expect(rows.some((r) => r.labels.some((l) => /: Top$/.test(l)))).toBe(false);
    expect(rows.some((r) => r.labels.some((l) => /: Bottom$/.test(l)))).toBe(true);
    const twice = { ...p, items: p.items.map((it, i) => (i === 0 ? { ...it, quantity: 2 } : it)) };
    expect(
      commonPanelCheck(
        twice,
        twice.items.map((i) => i.id),
        'top',
      ).reason,
    ).toMatch(/more than once/);
  });

  it('a version-16 project with common panels is invalid; 17 loads; pruneCommon drops a list left with one', () => {
    const p = linked(pair());
    expect(PROJECT_SCHEMA).toBe(17);
    expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual([]);
    expect(validateProject({ ...p, schemaVersion: 16 })).toContain(
      'Common tops and bottoms need project schemaVersion 17',
    );
    expect(validateProject({ ...pair(), schemaVersion: 16 })).toEqual([]);
    expect(
      validateProject({ ...p, common: [{ id: 'x', kind: 'side', itemIds: p.common![0].itemIds }] }),
    ).toContain('Invalid common top or bottom');
    const one = { ...p, items: [p.items[0]] };
    expect(pruneCommon(one).common).toBeUndefined();
    expect(pruneCommon(p)).toBe(p);
  });

  it('is one undo step in the store and refused with the reason when the items cannot share', async () => {
    const { useDesign } = await import('../src/store/designStore');
    const st = () => useDesign.getState();
    const p = pair();
    st().openProject(p);
    const before = st().project;
    st().selectItem(p.items[0].id);
    st().toggleItem(p.items[1].id);
    expect(st().setCommon('top', true)).toBe('');
    expect(st().project!.common).toHaveLength(1);
    st().undoProject();
    expect(st().project).toBe(before);
    st().selectItem(p.items[0].id);
    st().toggleItem(p.items[1].id);
    expect(st().setCommon('bottom', true)).toBe('');
    expect(st().setCommon('bottom', false)).toBe('');
    expect(st().project!.common).toBeUndefined();
  });
});

// Neighbours share one side panel (ADR-190).
import { describe, expect, it } from 'vitest';
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
import { pruneShared, sharedSideCheck } from '../src/core/shared';
import type { CabinetParams, Design, Panel } from '../src/core/types';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const withCab = (d: Design, patch: Partial<CabinetParams>): Design =>
  d.product.kind === 'cabinet'
    ? { ...d, product: { ...d.product, params: { ...d.product.params, ...patch } } }
    : d;
function pair(a: Partial<CabinetParams> = {}, b: Partial<CabinetParams> = {}): Project {
  const p = newProject('Shared');
  const A = { ...makeItem(p, withCab(t('base-door'), a)), position: { x: 0, y: 0, z: 0 } };
  const B = { ...makeItem(p, withCab(t('base-door'), b)), position: { x: 600, y: 0, z: 0 } };
  return { ...p, items: [A, B] };
}
const linked = (p: Project): Project => ({
  ...p,
  sharedSides: [{ id: 's', itemIds: p.items.map((i) => i.id) }],
});
const of = (p: Project, itemId: string, role: string): Panel[] =>
  buildProjectModel(p).model.panels.filter((x) => x.id.startsWith(`${itemId}:`) && x.role === role);
const codes = (p: Project) => buildProjectModel(p).diagnostics.map((d) => d.code);
const errors = (p: Project) =>
  buildProjectModel(p).diagnostics.filter((d) => d.severity === 'error');

describe('shared sides (ADR-190)', () => {
  it('two linked 600 mm cabinets: 3 sides, places and carcasses unchanged, the left inside one thickness wider', () => {
    const p = pair();
    const [A, B] = p.items;
    const sides = (q: Project) =>
      buildProjectModel(q).model.panels.filter((x) => x.role === 'side');
    expect(sides(p)).toHaveLength(4);
    const q = linked(p);
    expect(sides(q)).toHaveLength(3);
    expect(of(q, A.id, 'side').map((x) => x.label)).toEqual(['Left side']);
    expect(q.items.map((i) => i.position)).toEqual(p.items.map((i) => i.position));
    // Outside sizes stay: the left item's outline is its own, though its door reaches over the shared side.
    expect(buildProjectModel(q).pieces.map((pc) => pc.bounds)).toEqual(
      buildProjectModel(p).pieces.map((pc) => pc.bounds),
    );
    // The carcass boxes (tops) stay where they were.
    expect(of(q, A.id, 'top')[0].box).toEqual(of(p, A.id, 'top')[0].box);
    expect(of(q, B.id, 'top')[0].box).toEqual(of(p, B.id, 'top')[0].box);
    // The left inside reaches the shared side: its shelf is one thickness (18 mm) wider.
    expect(of(q, A.id, 'shelf')[0].box.w - of(p, A.id, 'shelf')[0].box.w).toBe(18);
    expect(errors(q)).toEqual([]);
    expect(
      projectCutlist(q)
        .filter((r) => r.labels.some((l) => / side$/.test(l)))
        .reduce((n, r) => n + r.quantity, 0),
    ).toBe(3);
  });

  it('fronts meet over the middle of the shared side, a front gap apart; outer edges unchanged', () => {
    const p = pair();
    const q = linked(p);
    const [A, B] = q.items;
    const a = of(q, A.id, 'door')[0].box,
      b = of(q, B.id, 'door')[0].box;
    const g = 3; // the base unit's front gap
    expect(b.x - (a.x + a.w)).toBe(g);
    // The middle of B's left side (x 600–618) is 609: A's door stops short of it, B's starts past it.
    expect(a.x + a.w).toBeLessThan(609);
    expect(b.x).toBeGreaterThan(609);
    expect(of(q, A.id, 'door')[0].box.x).toBe(of(p, A.id, 'door')[0].box.x);
    expect(b.x + b.w).toBe(of(p, B.id, 'door')[0].box.x + of(p, B.id, 'door')[0].box.w);
  });

  it('the shared side carries pin rows on both faces when both have adjustable shelves', () => {
    const shelves = { interior: { id: 'i', kind: 'shelves' as const, count: 2, adjustable: true } };
    const q = linked(pair(shelves, shelves));
    const left = buildProjectModel(q).model.panels.find(
      (x) => x.id.startsWith(`${q.items[1].id}:`) && x.label === 'Left side',
    )!;
    const faces = new Set((left.pinRows ?? []).map((r) => r.face));
    expect(faces.size).toBe(2);
    expect(buildProjectModel(q).diagnostics.map((d) => d.code)).not.toContain('pin-rows-no-panel');
  });

  it('refuses with the reason; a moved member breaks the link; schema 18; pruning', () => {
    const ids = (p: Project) => p.items.map((i) => i.id);
    const ok = pair();
    expect(sharedSideCheck(ok, ids(ok)).reason).toBeNull();
    const h = pair({}, { height: 700 });
    expect(sharedSideCheck(h, ids(h)).reason).toMatch(/height/);
    const d = pair({}, { depth: 500 });
    expect(sharedSideCheck(d, ids(d)).reason).toMatch(/depth/);
    let w = newProject('W');
    w = { ...w, items: [{ ...makeItem(w, t('base-door')), position: { x: 0, y: 0, z: 0 } }] };
    w = {
      ...w,
      items: [...w.items, { ...makeItem(w, t('corner-blind')), position: { x: 600, y: 0, z: 0 } }],
    };
    // ADR-207: a blind corner may share a side, but not at its blind end (here its left end meets the cabinet).
    expect(sharedSideCheck(w, ids(w)).reason).toMatch(
      /^Blind corner base meets its neighbour at its blind end; only its straight end shares a side\.$/,
    );
    const q = linked(pair());
    const moved = {
      ...q,
      items: q.items.map((it, i) =>
        i === 1 ? { ...it, position: { ...it.position, x: 610 } } : it,
      ),
    };
    expect(codes(moved)).toContain('shared-side-broken');
    expect(buildProjectModel(moved).model.panels.filter((x) => x.role === 'side')).toHaveLength(4);
    expect(PROJECT_SCHEMA).toBeGreaterThanOrEqual(20);
    expect(validateProject(JSON.parse(JSON.stringify(q)))).toEqual([]);
    expect(validateProject({ ...q, schemaVersion: 19 })).toContain(
      'Shared sides need project schemaVersion 20',
    );
    // Every older version still loads without the field.
    for (let v = 1; v <= 19; v++)
      expect(
        validateProject({ ...pair(), schemaVersion: v } as never).filter((e) =>
          e.includes('schemaVersion'),
        ),
        String(v),
      ).toEqual([]);
    expect(pruneShared({ ...q, items: [q.items[0]] }).sharedSides).toBeUndefined();
    expect(pruneShared(q)).toBe(q);
  });
});

// ADR-207 (G-354): a blind corner unit at its straight end and a desk at a gable end share a side with a cabinet.
describe('shared sides with blind corners and desks (ADR-207)', () => {
  const ids = (p: Project) => p.items.map((i) => i.id);
  /** Pieces at the given x, in that order, on the floor at the back. */
  function at(...pieces: [Design, number][]): Project {
    const p = newProject('Shared 207');
    return {
      ...p,
      items: pieces.map(([d, x]) => ({ ...makeItem(p, d), position: { x, y: 0, z: 0 } })),
    };
  }
  const corner = (side: 'left' | 'right'): Design => {
    const d = t('corner-blind');
    return d.product.kind === 'corner'
      ? { ...d, product: { ...d.product, params: { ...d.product.params, side } } }
      : d;
  };
  const roleCount = (p: Project, itemId: string, roles: string[]) =>
    buildProjectModel(p).model.panels.filter(
      (x) => x.id.startsWith(`${itemId}:`) && roles.includes(x.role),
    ).length;
  const labels = (p: Project, itemId: string, role: string) =>
    of(p, itemId, role).map((x) => x.label);
  const bounds = (p: Project) => buildProjectModel(p).pieces.map((pc) => pc.bounds);
  const allSides = (p: Project) =>
    buildProjectModel(p).model.panels.filter((y) => y.role === 'side').length;
  /**
   * A cabinet the desk's size: its height, its gable depth (depth − front overhang), no plinth, and an inset back so
   * its sides run its full depth as a desk's gables do.
   */
  const deskCab = (depth = 570) =>
    withCab(t('base-door'), {
      height: 750,
      depth,
      plinthHeight: 0,
      plinthSetback: 0,
      back: 'inset',
    });

  it('a blind corner beside a cabinet at its straight end: one side less, outlines unchanged', () => {
    // Cabinet on the left, a blind corner on the right with its blind section right: its straight end meets.
    const p = at([t('base-door'), 0], [corner('right'), 600]);
    expect(sharedSideCheck(p, ids(p)).reason).toBeNull();
    const q = linked(p);
    const [A] = q.items;
    expect(allSides(q)).toBe(allSides(p) - 1);
    // ADR-190: the right member's side is shared, so the left cabinet leaves out its right side.
    expect(labels(q, A.id, 'side')).toEqual(['Left side']);
    expect(bounds(q)).toEqual(bounds(p));
    expect(errors(q)).toEqual([]);
    expect(codes(q)).not.toContain('shared-side-broken');
    // A blind corner on the left, its straight end (right) against a cabinet: shared too.
    const r = at([corner('left'), 0], [t('base-door'), 1000]);
    expect(sharedSideCheck(r, ids(r)).reason).toBeNull();
    const rq = linked(r);
    expect(allSides(rq)).toBe(allSides(r) - 1);
    expect(labels(rq, rq.items[1].id, 'side')).toEqual(['Left side', 'Right side']);
    expect(bounds(rq)).toEqual(bounds(r));
    expect(errors(rq)).toEqual([]);
  });

  it('a desk beside a cabinet: the cabinet keeps its side, the desk drops its gable; outlines unchanged', () => {
    const p = at([deskCab(), 0], [t('desk-gables'), 600]);
    expect(sharedSideCheck(p, ids(p)).reason).toBeNull();
    const q = linked(p);
    const [cab, desk] = q.items;
    expect(roleCount(q, cab.id, ['side'])).toBe(2);
    expect(roleCount(p, desk.id, ['gable'])).toBe(2);
    expect(labels(q, desk.id, 'gable')).toEqual(['Right gable']);
    expect(bounds(q)).toEqual(bounds(p));
    expect(errors(q)).toEqual([]);
    // The desk on the left: its right gable goes, the cabinet keeps both sides.
    const r = linked(at([t('desk-gables'), 0], [deskCab(), 1200]));
    expect(labels(r, r.items[0].id, 'gable')).toEqual(['Left gable']);
    expect(roleCount(r, r.items[1].id, ['side'])).toBe(2);
    expect(errors(r)).toEqual([]);
  });

  it('cabinet pairs are built as before (ADR-190 unchanged)', () => {
    const q = linked(pair());
    const [A, B] = q.items;
    expect(labels(q, A.id, 'side')).toEqual(['Left side']);
    expect(roleCount(q, B.id, ['side'])).toBe(2);
  });

  it('desk with desk, an L-shape corner, a blind end, a pedestal end and loose panels are refused with the reason', () => {
    const dd = at([t('desk-gables'), 0], [t('desk-gables'), 1200]);
    expect(sharedSideCheck(dd, ids(dd)).reason).toBe(
      'Panel desk and Panel desk are both desks; a desk shares a side only with a cabinet.',
    );
    const l = at([t('base-door'), 0], [t('corner-l'), 600]);
    expect(sharedSideCheck(l, ids(l)).reason).toBe(
      'L-shaped corner base is an L-shape or diagonal corner unit; only a blind corner shares a side.',
    );
    const blind = at([t('base-door'), 0], [corner('left'), 600]);
    expect(sharedSideCheck(blind, ids(blind)).reason).toMatch(/at its blind end/);
    // The desk with pedestal has its pedestal on the left: a cabinet on its left meets the pedestal end.
    const ped = at([deskCab(670), 0], [t('desk-pedestal'), 600]);
    expect(sharedSideCheck(ped, ids(ped)).reason).toBe(
      'Desk with pedestal has a pedestal at that end; only a gable end shares a side.',
    );
    const loose = at([t('base-door'), 0], [t('panels'), 600]);
    expect(sharedSideCheck(loose, ids(loose)).reason).toBe(
      'Loose panels is not a cabinet, a blind corner unit or a desk.',
    );
    // A refused link is warned about and not built: the pieces keep both their gables.
    const broken = linked(dd);
    expect(codes(broken)).toContain('shared-side-broken');
    expect(roleCount(broken, broken.items[0].id, ['gable'])).toBe(2);
    expect(errors(broken)).toEqual([]);
  });
});

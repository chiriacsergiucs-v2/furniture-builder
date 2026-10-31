// Neighbours share one side panel (ADR-170).
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

describe('shared sides (ADR-170)', () => {
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
    expect(sharedSideCheck(w, ids(w)).reason).toMatch(/not a cabinet/);
    const q = linked(pair());
    const moved = {
      ...q,
      items: q.items.map((it, i) =>
        i === 1 ? { ...it, position: { ...it.position, x: 610 } } : it,
      ),
    };
    expect(codes(moved)).toContain('shared-side-broken');
    expect(buildProjectModel(moved).model.panels.filter((x) => x.role === 'side')).toHaveLength(4);
    expect(PROJECT_SCHEMA).toBe(18);
    expect(validateProject(JSON.parse(JSON.stringify(q)))).toEqual([]);
    expect(validateProject({ ...q, schemaVersion: 17 })).toContain(
      'Shared sides need project schemaVersion 18',
    );
    expect(pruneShared({ ...q, items: [q.items[0]] }).sharedSides).toBeUndefined();
    expect(pruneShared(q)).toBe(q);
  });
});

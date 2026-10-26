import { describe, expect, it } from 'vitest';
import { findFamily, insertVariant } from '../src/core/catalog';
import { COMPAT_RULES, compatChecks, compatRule, evaluate, mountOf } from '../src/core/compat';
import { templates } from '../src/core/design';
import {
  buildProjectModel,
  makeItem,
  newProject,
  suggestRunParts,
  type Project,
} from '../src/core/project';
import { snapDrag } from '../src/core/snap';
import type { Design } from '../src/core/types';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const fromCatalog = (family: string, variant?: string): Design => {
  const f = findFamily(family)!;
  const v = variant ? f.variants.find((x) => x.id === variant)! : f.variants[0];
  return insertVariant(f, v, '2026-10-26T00:00:00.000Z')!;
};

/** A project with the given designs at the given x (z = 0, no turn). */
function project(pieces: { d: Design; x: number }[]): Project {
  let p = newProject('Compat');
  for (const s of pieces) {
    const it = makeItem(p, s.d);
    p = { ...p, items: [...p.items, { ...it, position: { ...it.position, x: s.x, z: 0 } }] };
  }
  return p;
}
const withDepth = (d: Design, depth: number): Design => {
  const c = structuredClone(d);
  if (c.product.kind === 'cabinet') c.product.params.depth = depth;
  return c;
};
const withHeight = (d: Design, height: number): Design => {
  const c = structuredClone(d);
  if (c.product.kind === 'cabinet') c.product.params.height = height;
  return c;
};

describe('the rule table (ADR-100)', () => {
  it('holds the three ADR-070 rules and the depth, height and family rules as data', () => {
    expect(COMPAT_RULES.map((r) => [r.id, r.severity])).toEqual([
      ['side-only', 'refuse'],
      ['same-mount', 'refuse'],
      ['back-to-wall', 'refuse'],
      ['depth-match', 'warning'],
      ['height-match', 'warning'],
      ['family', 'refuse'],
    ]);
    for (const r of COMPAT_RULES) {
      expect(r.text.length).toBeGreaterThan(10);
      expect(r.check.predicate).toBeTruthy();
      expect(r.where.length).toBeGreaterThan(0);
    }
    // Any difference warns: no tolerance until the user names one.
    expect(compatRule('depth-match').check.params.tolerance).toBe(0);
    const base = makeItem(newProject(), fromCatalog('base-doors'));
    const pair = (depthB: number) =>
      evaluate('checks', {
        a: base,
        mountA: 'floor',
        faceA: 'side',
        b: base,
        mountB: 'floor',
        faceB: 'side',
        depthA: 560,
        depthB,
      }).map((f) => f.reason);
    expect(pair(561)).toEqual(['depth 560 vs 561']);
    expect(pair(560)).toEqual([]);
  });
  it('rules test what a piece is, never a brand', () => {
    for (const r of COMPAT_RULES) expect(JSON.stringify(r)).not.toMatch(/brand/i);
  });
});

describe('depth match (ADR-100)', () => {
  it('two touching base units of different depths warn in Checks, naming both depths', () => {
    const base = fromCatalog('base-doors');
    const p0 = project([{ d: base, x: 0 }]);
    const w = buildProjectModel(p0).pieces[0].bounds.w;
    const p = project([
      { d: base, x: 0 },
      { d: withDepth(base, 500), x: w },
    ]);
    const pm = buildProjectModel(p);
    const ds = pm.diagnostics.filter((d) => d.code === 'compat-depth-match');
    expect(ds).toHaveLength(1);
    expect(ds[0].severity).toBe('warning');
    // Carcass depths (the footprint also holds the doors).
    const depthOf = (d: Design) => (d.product.kind === 'cabinet' ? d.product.params.depth : 0);
    const [da, db] = [depthOf(p.items[0].design), depthOf(p.items[1].design)];
    expect(da).not.toBe(db);
    expect(ds[0].message).toContain(`depth ${da} vs ${db}`);
    expect(ds[0].message).toContain(compatRule('depth-match').text);
    expect(ds[0].itemIds).toEqual([p.items[0].id, p.items[1].id]);
    // Never an error: export is not blocked.
    expect(pm.diagnostics.some((d) => d.severity === 'error')).toBe(false);
  });
  it('equal depths, or a gap between the units, give no warning', () => {
    const base = fromCatalog('base-doors');
    const w = buildProjectModel(project([{ d: base, x: 0 }])).pieces[0].bounds.w;
    const same = buildProjectModel(
      project([
        { d: base, x: 0 },
        { d: base, x: w },
      ]),
    );
    expect(same.diagnostics.filter((d) => d.code.startsWith('compat-'))).toEqual([]);
    const apart = buildProjectModel(
      project([
        { d: base, x: 0 },
        { d: withDepth(base, 500), x: w + 10 },
      ]),
    );
    expect(apart.diagnostics.filter((d) => d.code.startsWith('compat-'))).toEqual([]);
  });
  it('is named in the snap preview', () => {
    const base = fromCatalog('base-doors');
    const w = buildProjectModel(project([{ d: base, x: 0 }])).pieces[0].bounds.w;
    const p = project([
      { d: base, x: 0 },
      { d: withDepth(base, 500), x: 2000 },
    ]);
    const r = snapDrag(p, buildProjectModel(p).pieces, p.items[1].id, w + 20 - 2000, 0)!;
    expect(r.position.x).toBe(w);
    expect(r.snap?.notes.some((n) => /^depth \d+ vs \d+$/.test(n))).toBe(true);
  });
});

describe('height match (ADR-100)', () => {
  it('touching base units of different heights under one run worktop warn', () => {
    const base = fromCatalog('base-doors');
    const w = buildProjectModel(project([{ d: base, x: 0 }])).pieces[0].bounds.w;
    let p = project([
      { d: base, x: 0 },
      { d: withHeight(base, 800), x: w },
    ]);
    // Without a worktop: no height warning.
    expect(
      buildProjectModel(p).diagnostics.filter((d) => d.code === 'compat-height-match'),
    ).toEqual([]);
    p = { ...p, runParts: suggestRunParts(p) };
    expect(p.runParts!.some((r) => r.kind === 'worktop' && r.from?.length === 2)).toBe(true);
    const pm = buildProjectModel(p);
    const ds = pm.diagnostics.filter((d) => d.code === 'compat-height-match');
    expect(ds).toHaveLength(1);
    expect(ds[0].severity).toBe('warning');
    expect(ds[0].message).toContain(`height ${pm.pieces[0].bounds.h} vs ${pm.pieces[1].bounds.h}`);
    expect(ds[0].message).toContain(compatRule('height-match').text);
  });
});

describe('family (ADR-100)', () => {
  const bed = () => fromCatalog('bed', 'bed-platform');
  it('families that share no room: a bed and a kitchen base', () => {
    const p = project([
      { d: fromCatalog('base-doors'), x: 0 },
      { d: bed(), x: 3000 },
    ]);
    const familyReason = (a: Project['items'][number], b: Project['items'][number]) =>
      evaluate('snap', {
        a,
        mountA: mountOf(a),
        faceA: 'side',
        b,
        mountB: mountOf(b),
        faceB: 'side',
      }).find((f) => f.rule.id === 'family')?.message ?? null;
    const why = familyReason(p.items[1], p.items[0])!;
    expect(why).toContain(compatRule('family').text);
    expect(why).toMatch(/Bedroom/);
    expect(why).toMatch(/Kitchen/);
    // Families sharing a room (a wall cabinet is kitchen and living room) are fine.
    const q = project([
      { d: fromCatalog('base-doors'), x: 0 },
      { d: fromCatalog('wall-cabinet'), x: 3000 },
    ]);
    expect(familyReason(q.items[0], q.items[1])).toBeNull();
    // A piece with no catalog family is never refused.
    const r = project([
      { d: t('base-door'), x: 0 },
      { d: bed(), x: 3000 },
    ]);
    expect(familyReason(r.items[1], r.items[0])).toBeNull();
  });
  it('a bed dragged next to a kitchen base does not snap to its side, and says why', () => {
    const base = fromCatalog('base-doors');
    const p = project([
      { d: base, x: 0 },
      { d: bed(), x: 3000 },
    ]);
    const pm = buildProjectModel(p);
    const w = pm.pieces[0].bounds.w;
    const r = snapDrag(p, pm.pieces, p.items[1].id, w + 30 - 3000, 0)!;
    // Not flush with the base: the side candidate is removed.
    expect(r.snap?.label ?? '').not.toMatch(/joins/i);
    expect(r.position.x).not.toBe(w);
    const text = [r.hint, ...r.refused].filter(Boolean).join(' ');
    expect(text).toMatch(/^Won’t snap to .*family rule/);
    expect(r.refused[0]).toMatch(/^Won’t snap to Base cabinet.*: .*family rule/);
  });
  it('the same pair touching anyway (placed freely) warns in Checks', () => {
    const base = fromCatalog('base-doors');
    const w = buildProjectModel(project([{ d: base, x: 0 }])).pieces[0].bounds.w;
    const pm = buildProjectModel(
      project([
        { d: base, x: 0 },
        { d: bed(), x: w },
      ]),
    );
    const ds = pm.diagnostics.filter((d) => d.code === 'compat-family');
    expect(ds).toHaveLength(1);
    expect(ds[0].severity).toBe('warning');
    expect(ds[0].message).toContain('family rule');
  });
  it('is deterministic: the same input gives the same checks', () => {
    const base = fromCatalog('base-doors');
    const w = buildProjectModel(project([{ d: base, x: 0 }])).pieces[0].bounds.w;
    const p = project([
      { d: base, x: 0 },
      { d: withDepth(base, 500), x: w },
    ]);
    const pieces = buildProjectModel(p).pieces;
    expect(compatChecks(pieces)).toEqual(compatChecks(pieces));
  });
});

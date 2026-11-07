// ADR-210 (N215): the family rule for your own templates (G-103), variables in a piece (G-335), the move repair for
// the family warning (G-396), project seller items (G-313) and Brands from the decor list (G-044, pure part).
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { findFamily, insertVariant, type CatalogFamily } from '../src/core/catalog';
import { decorBrands, usesBrand } from '../src/core/catalog/decorBrands';
import { fromLocal, templateFromDesign } from '../src/core/catalog/local';
import { evaluate, familyRooms, mountOf } from '../src/core/compat';
import { cutlist } from '../src/core/cutlist';
import { SCHEMA_VERSION, templates, upgradeDesign, validateDesign } from '../src/core/design';
import type { Decor } from '../src/core/materials';
import {
  buildProjectModel,
  makeItem,
  newProject,
  PROJECT_SCHEMA,
  validateProject,
  type Project,
  type ProjectItem,
} from '../src/core/project';
import { projectEstimate } from '../src/core/projectEstimate';
import {
  projectFromTemplate,
  templateFromProject,
  TEMPLATE_SCHEMA,
  validateProjectTemplate,
} from '../src/core/projectTemplate';
import { repairsFor, settle } from '../src/core/repairs';
import { shapeOutline, type Room } from '../src/core/room';
import {
  projectSellerChoices,
  projectSellerItemQuantity,
  projectWithSellerItem,
} from '../src/core/sellers/choices';
import type { CabinetParams, Design, SellerItem } from '../src/core/types';
import {
  addDesignVariable,
  applyBindings,
  applyDesignBindings,
  applyPieceBindings,
  designVariableDiagnostics,
  setBinding,
  setDesignBinding,
} from '../src/core/variables';
import { loadProject, saveProject } from '../src/persist/db';
import { useDesign } from '../src/store/designStore';

const NOW = '2026-11-06T00:00:00.000Z';
const fromCatalog = (family: string, variant?: string): Design => {
  const f = findFamily(family)!;
  const v = variant ? f.variants.find((x) => x.id === variant)! : f.variants[0];
  return insertVariant(f, v, NOW)!;
};
/** The user's own family (a local template, ADR-034/107) for a shipped variant, with these rooms. */
const own = (rooms: CatalogFamily['rooms'], family = 'bed', variant = 'bed-platform'): Design =>
  insertVariant(
    { id: 'own-guest-bed', name: 'Guest bed', catalogVersion: 1, rooms },
    findFamily(family)!.variants.find((x) => x.id === variant)!,
    NOW,
  )!;
const tpl = (id: string) => templates.find((x) => x.id === id)!.create();
const rect = (w = 6000, d = 3000): Room => ({
  height: 2600,
  outline: shapeOutline('rectangle', { width: w, depth: d, cutWidth: 0, cutDepth: 0, offset: 0 }),
  features: [],
});
/** A project with the given designs at the given x, backs on wall 1 (z = 0), in an optional room. */
function project(pieces: { d: Design; x: number }[], room?: Room): Project {
  let p = newProject('ADR-210');
  if (room) p = { ...p, room };
  for (const s of pieces) {
    const it = makeItem(p, s.d);
    p = { ...p, items: [...p.items, { ...it, position: { ...it.position, x: s.x, z: 0 } }] };
  }
  return p;
}
const familyWhy = (a: ProjectItem, b: ProjectItem) =>
  evaluate('snap', {
    a,
    mountA: mountOf(a),
    faceA: 'side',
    b,
    mountB: mountOf(b),
    faceB: 'side',
  }).find((f) => f.rule.id === 'family')?.message ?? null;
const width = (d: Design) => (d.product.params as CabinetParams).width;

describe('own families keep their rooms (ADR-210, G-103)', () => {
  it('insertVariant writes origin.rooms for an own- family only', () => {
    expect(own(['bedroom']).catalog?.origin?.rooms).toEqual(['bedroom']);
    expect(fromCatalog('bed', 'bed-platform').catalog?.origin?.rooms).toBeUndefined();
    // An own family with no rooms records none.
    expect(own([]).catalog?.origin?.rooms).toBeUndefined();
    expect(validateDesign(own(['bedroom']))).toEqual([]);
  });

  it('familyRooms falls back to origin.rooms when no shipped family matches', () => {
    const it = makeItem(newProject('x'), own(['bedroom', 'kids']));
    expect(familyRooms(it)?.rooms).toEqual(['bedroom', 'kids']);
    expect(familyRooms(it)?.name).toMatch(/^Guest bed — /);
    // A shipped family still wins.
    const base = makeItem(newProject('x'), fromCatalog('base-doors'));
    expect(familyRooms(base)?.rooms).toEqual(findFamily('base-doors')!.rooms);
  });

  it('a bedroom-only own piece beside a kitchen base is refused on snap and warned in Checks', () => {
    const base = fromCatalog('base-doors');
    const w = buildProjectModel(project([{ d: base, x: 0 }])).pieces[0].bounds.w;
    const p = project([
      { d: base, x: 0 },
      { d: own(['bedroom']), x: w },
    ]);
    const why = familyWhy(p.items[1], p.items[0]);
    expect(why).toMatch(/family rule/);
    expect(why).toMatch(/Guest bed/);
    const ds = buildProjectModel(p).diagnostics.filter((d) => d.code === 'compat-family');
    expect(ds).toHaveLength(1);
    expect(ds[0].severity).toBe('warning');
    // The same own family with a kitchen among its rooms is fine.
    const q = project([
      { d: base, x: 0 },
      { d: own(['bedroom', 'kitchen']), x: w },
    ]);
    expect(familyWhy(q.items[1], q.items[0])).toBeNull();
    expect(buildProjectModel(q).diagnostics.some((d) => d.code === 'compat-family')).toBe(false);
  });

  it('pieces inserted earlier (no origin.rooms) stay unchecked and are not rewritten', () => {
    const before = own(['bedroom']);
    delete before.catalog!.origin!.rooms;
    const base = fromCatalog('base-doors');
    const w = buildProjectModel(project([{ d: base, x: 0 }])).pieces[0].bounds.w;
    const p = project([
      { d: base, x: 0 },
      { d: before, x: w },
    ]);
    expect(familyWhy(p.items[1], p.items[0])).toBeNull();
    expect(buildProjectModel(p).diagnostics.some((d) => d.code === 'compat-family')).toBe(false);
    expect(upgradeDesign(structuredClone(before)).catalog?.origin?.rooms).toBeUndefined();
  });

  it(`origin.rooms needs schemaVersion ${SCHEMA_VERSION} and known rooms; files 1–${SCHEMA_VERSION} still load`, () => {
    const d = own(['bedroom']);
    expect(d.schemaVersion).toBe(SCHEMA_VERSION);
    expect(validateDesign({ ...d, schemaVersion: SCHEMA_VERSION - 1 })).toContain(
      `Catalog origin rooms need schemaVersion ${SCHEMA_VERSION}`,
    );
    const withRooms = (rooms: unknown) => ({
      ...d,
      catalog: { ...d.catalog, origin: { ...d.catalog!.origin!, rooms } },
    });
    for (const bad of [['garage'], [], 'bedroom', ['bedroom', 7]])
      expect(validateDesign(withRooms(bad)), JSON.stringify(bad)).toContain(
        'Invalid catalog origin rooms',
      );
    // A piece of every older version with no new field still loads.
    const plain = fromCatalog('bed', 'bed-platform');
    for (let v = 1; v <= SCHEMA_VERSION; v++) {
      const old = { ...tpl('base-door'), schemaVersion: v } as Design;
      expect(validateDesign(old), `base-door v${v}`).toEqual([]);
      if (v >= 3) expect(validateDesign({ ...plain, schemaVersion: v }), `bed v${v}`).toEqual([]);
    }
  });
});

describe('variables in a piece (ADR-210, G-335)', () => {
  /** A base cabinet whose width is bound to its own variable `w`. */
  function bound(w: string): Design {
    const r = addDesignVariable(tpl('base-door'), 'w', w);
    return setDesignBinding({ ...r.design, schemaVersion: SCHEMA_VERSION }, 'width', 'w');
  }

  it('a width variable drives the cut list', () => {
    const d0 = tpl('base-door');
    const d = applyDesignBindings(bound('500'));
    expect(width(d)).toBe(500);
    expect(validateDesign(d)).toEqual([]);
    const m = buildModel(d);
    expect(m.diagnostics.filter((x) => x.severity === 'error')).toEqual([]);
    const lengths = (x: Design) =>
      cutlist(buildModel(x), x.materials)
        .map((r) => `${r.length}×${r.width}`)
        .sort();
    // The cut list changes with the variable: 500 vs 700 mm wide.
    const d700 = applyDesignBindings(bound('700'));
    expect(width(d700)).toBe(700);
    expect(lengths(d)).not.toEqual(lengths(d700));
    expect(lengths(d)).not.toEqual(lengths(d0));
    // Through the store: binding the open piece's width commits the bound value.
    const s = useDesign.getState;
    s().load(tpl('base-door'));
    s().addDesignVariable('w', '640');
    s().bindDesignTarget('width', 'w');
    expect(width(s().design)).toBe(640);
    expect(s().design.bindings).toEqual([{ target: 'width', expr: 'w' }]);
    // Undo takes the binding away again (one step each).
    s().undo();
    expect(s().design.bindings).toBeUndefined();
  });

  it('a bad formula is an error that blocks export; the field keeps its number', () => {
    const d = applyDesignBindings(bound('w +'));
    expect(width(d)).toBe(width(tpl('base-door')));
    const ds = designVariableDiagnostics(d);
    expect(ds.length).toBeGreaterThan(0);
    expect(ds.every((x) => x.severity === 'error')).toBe(true);
    // The model carries it: export is blocked by any error (ADR-008).
    expect(buildModel(d).diagnostics.some((x) => x.severity === 'error')).toBe(true);
    // Inside a project too.
    const p = project([{ d, x: 0 }]);
    expect(buildProjectModel(p).diagnostics.some((x) => x.severity === 'error')).toBe(true);
    // An unknown name is an error as well.
    const unknown = setDesignBinding(bound('500'), 'width', 'nope * 2');
    expect(designVariableDiagnostics(unknown).map((x) => x.code)).toContain('binding-problem');
  });

  it('a catalog template of your own keeps the piece’s variables and records its rooms on each copy', () => {
    const local = templateFromDesign(bound('600'), {
      name: 'Hall unit',
      function: 'storage',
      rooms: ['hallway'],
    });
    const fam = fromLocal(local);
    expect(fam.id.startsWith('own-')).toBe(true);
    const copy = insertVariant(fam, fam.variants[0], NOW)!;
    expect(copy.catalog?.origin?.rooms).toEqual(['hallway']);
    expect(copy.variables?.map((v) => [v.name, v.expr])).toEqual([['w', '600']]);
    expect(copy.bindings).toEqual([{ target: 'width', expr: 'w' }]);
    expect(validateDesign(copy)).toEqual([]);
    expect(width(applyDesignBindings(copy))).toBe(600);
    // Beside a kitchen base it is warned about (hallway and kitchen share no room).
    const base = fromCatalog('base-doors');
    const w = buildProjectModel(project([{ d: base, x: 0 }])).pieces[0].bounds.w;
    const p = project([
      { d: base, x: 0 },
      { d: copy, x: w },
    ]);
    expect(buildProjectModel(p).diagnostics.some((d) => d.code === 'compat-family')).toBe(true);
  });

  it('validation: version, targets (no positions) and names', () => {
    const d = bound('500');
    expect(validateDesign(d)).toEqual([]);
    expect(validateDesign({ ...d, schemaVersion: SCHEMA_VERSION - 1 })).toContain(
      `Piece variables need schemaVersion ${SCHEMA_VERSION}`,
    );
    for (const target of ['x', 'position.x', 'rotationY', 'split:a'])
      expect(validateDesign({ ...d, bindings: [{ target, expr: '1' }] }), target).toContain(
        'Invalid piece bindings',
      );
    for (const target of ['height', 'depth', 'mountHeight', 'split:root:0'])
      expect(validateDesign({ ...d, bindings: [{ target, expr: '1' }] }), target).toEqual([]);
    expect(
      validateDesign({
        ...d,
        variables: [
          { id: 'a', name: 'w', expr: '1' },
          { id: 'b', name: 'W', expr: '2' },
        ],
      }),
    ).toContain('Invalid variable');
  });

  it('inside a project the piece’s own variables are its parameters; a project binding on the target wins', () => {
    let p = project([{ d: bound('500'), x: 0 }]);
    const id = p.items[0].id;
    // Its own binding alone: 500.
    const own = applyBindings(applyPieceBindings(p));
    expect(width(own.items[0].design)).toBe(500);
    // A project binding on the same target: the project's value wins.
    p = setBinding(p, id, 'width', '700');
    const both = applyBindings(applyPieceBindings(p));
    expect(width(both.items[0].design)).toBe(700);
    // Through the store's commit as well.
    const s = useDesign.getState;
    s().openProject(p);
    s().updateProject((x) => x);
    expect(width(s().project!.items[0].design)).toBe(700);
  });
});

describe('the family warning offers move repairs (ADR-210, G-396)', () => {
  /** A kitchen base on wall 1 and a bed touching its right side, in a 6000 × 3000 room. */
  function pair(lockBed = false, lockBase = false): Project {
    const base = fromCatalog('base-doors');
    const w = buildProjectModel(project([{ d: base, x: 0 }])).pieces[0].bounds.w;
    const p = project(
      [
        { d: base, x: 1000 },
        { d: fromCatalog('bed', 'bed-platform'), x: 1000 + w },
      ],
      rect(),
    );
    return {
      ...p,
      items: p.items.map((it, i) =>
        (i === 1 && lockBed) || (i === 0 && lockBase) ? { ...it, locked: true } : it,
      ),
    };
  }
  const warning = (p: Project) =>
    buildProjectModel(p).diagnostics.find((d) => d.code === 'compat-family');

  it('moves the later-placed piece (then the other) along its wall to clear it, labelled Move … mm …', () => {
    const p = pair();
    const pm = buildProjectModel(p);
    const d = warning(p)!;
    expect(d).toBeTruthy();
    const reps = repairsFor(p, pm, d).filter((r) => !r.refused);
    expect(reps.length).toBeGreaterThan(0);
    for (const r of reps) {
      expect(r.label).toMatch(/^Move .+ \d+ mm to the (left|right)$/);
      const after = buildProjectModel(settle(r.project));
      expect(
        after.diagnostics.some((x) => x.code === 'compat-family'),
        r.label,
      ).toBe(false);
      expect(
        after.diagnostics.filter((x) => x.severity === 'error'),
        r.label,
      ).toEqual([]);
      // Only along the wall: z unchanged.
      for (const [i, it] of r.project.items.entries())
        expect(it.position.z).toBe(p.items[i].position.z);
    }
    // The later-placed piece (the bed) is the first one offered to move.
    const moved = (r: (typeof reps)[number]) =>
      r.project.items.findIndex((it, i) => it.position.x !== p.items[i].position.x);
    expect(moved(reps[0])).toBe(1);
    const ds = reps.map((r) => r.distance);
    expect(ds).toEqual([...ds].sort((a, b) => a - b));
  });

  it('one undo step clears and brings back the warning', () => {
    const s = useDesign.getState;
    s().openProject(pair());
    const d = warning(s().project!)!;
    const [r] = repairsFor(s().project!, s().projectModel!, d).filter((x) => !x.refused);
    const past = s().projectPast.length;
    s().updateProject(() => r.project);
    expect(s().projectPast.length).toBe(past + 1);
    expect(s().projectModel!.diagnostics.some((x) => x.code === 'compat-family')).toBe(false);
    s().undoProject();
    expect(s().projectModel!.diagnostics.some((x) => x.code === 'compat-family')).toBe(true);
  });

  it('a locked piece is never moved', () => {
    for (const [lockBed, lockBase, still] of [
      [true, false, 1],
      [false, true, 0],
    ] as const) {
      const p = pair(lockBed, lockBase);
      const reps = repairsFor(p, buildProjectModel(p), warning(p)!).filter((r) => !r.refused);
      expect(reps.length).toBeGreaterThan(0);
      for (const r of reps)
        expect(settle(r.project).items[still].position).toEqual(p.items[still].position);
    }
    // Both locked: nothing to offer.
    const both = pair(true, true);
    expect(
      repairsFor(both, buildProjectModel(both), warning(both)!).filter((r) => !r.refused),
    ).toEqual([]);
  });
});

describe('project seller items (ADR-210, G-313)', () => {
  const leg: SellerItem = {
    seller: 'regency',
    id: 'LEG-100',
    name: 'Furniture leg 100 mm',
    quantity: 4,
  };
  const pin: SellerItem = { seller: 'regency', id: 'PIN-5', name: 'Shelf pin 5 mm', quantity: 1 };
  function withItems(): Project {
    const piece = { ...tpl('base-door'), sellerItems: [{ ...leg, quantity: 2 }] };
    let p = project([{ d: piece, x: 0 }]);
    p = { ...p, items: [{ ...p.items[0], quantity: 2 }] };
    return projectWithSellerItem(projectWithSellerItem(p, leg), pin);
  }
  beforeEach(() => {
    useDesign.getState().load(useDesign.getState().design);
  });

  it('are added once after the pieces’ items; the same product adds up; 0 removes', () => {
    const p = withItems();
    expect(p.schemaVersion).toBe(PROJECT_SCHEMA);
    expect(p.sellerItems).toEqual([leg, pin]);
    expect(validateProject(p)).toEqual([]);
    // 2 per piece × 2 copies + the project's 4.
    expect(projectSellerChoices(p).sellerItems).toEqual([{ ...leg, quantity: 8 }, pin]);
    expect(projectWithSellerItem(p, { ...pin, quantity: 2 }).sellerItems![1].quantity).toBe(3);
    expect(projectSellerItemQuantity(p, 'regency', 'PIN-5', 0).sellerItems).toEqual([leg]);
    // They show on the project's shopping list.
    const lines = projectEstimate(p, buildProjectModel(p), []).lines;
    expect(lines.some((l) => l.label.includes('Furniture leg 100 mm'))).toBe(true);
    expect(lines.some((l) => l.label.includes('Shelf pin 5 mm'))).toBe(true);
  });

  it(`need project schemaVersion ${PROJECT_SCHEMA}; bad items are refused; older files without them load`, () => {
    const p = withItems();
    expect(validateProject({ ...p, schemaVersion: PROJECT_SCHEMA - 1 })).toContain(
      `Project seller items need project schemaVersion ${PROJECT_SCHEMA}`,
    );
    expect(validateProject({ ...p, sellerItems: [{ ...leg, quantity: 0 }] })).toContain(
      'Invalid seller item',
    );
    expect(validateProject({ ...p, sellerItems: [{ ...leg, seller: '' }] })).toContain(
      'Invalid seller item',
    );
    expect(validateProject({ ...p, sellerItems: 'x' })).toContain('Invalid seller items');
    const plain = project([{ d: tpl('base-door'), x: 0 }]);
    for (const v of [1, PROJECT_SCHEMA - 1, PROJECT_SCHEMA])
      expect(validateProject({ ...plain, schemaVersion: v }), `v${v}`).toEqual([]);
  });

  it('save and reload on this device', async () => {
    const p = withItems();
    await saveProject(p);
    const back = await loadProject(p.id);
    expect(back?.sellerItems).toEqual([leg, pin]);
  });

  it(`travel in project templates (template ${TEMPLATE_SCHEMA}); template files without them load`, () => {
    const p = withItems();
    const t = templateFromProject(p, 'With items');
    expect(t.schemaVersion).toBe(TEMPLATE_SCHEMA);
    expect(t.sellerItems).toEqual([leg, pin]);
    expect(validateProjectTemplate(JSON.parse(JSON.stringify(t)))).toEqual([]);
    const q = projectFromTemplate(t);
    expect(q.sellerItems).toEqual([leg, pin]);
    expect(q.schemaVersion).toBe(PROJECT_SCHEMA);
    expect(validateProject(q)).toEqual([]);
    // Below the template version: refused.
    expect(validateProjectTemplate({ ...t, schemaVersion: TEMPLATE_SCHEMA - 1 })).toContain(
      `Seller items need template schemaVersion ${TEMPLATE_SCHEMA}`,
    );
    // A template without them, at the current and an older version, still loads and makes a project without them.
    const plain = templateFromProject(project([{ d: tpl('base-door'), x: 0 }]), 'Plain');
    expect(plain.sellerItems).toBeUndefined();
    for (const v of [1, TEMPLATE_SCHEMA])
      expect(validateProjectTemplate({ ...plain, schemaVersion: v }), `v${v}`).toEqual([]);
    expect(projectFromTemplate(plain).sellerItems).toBeUndefined();
  });

  it('Add seller product in the project view goes on the project’s list, one undo step', () => {
    const s = useDesign.getState;
    s().openProject(project([{ d: tpl('base-door'), x: 0 }]));
    const past = s().projectPast.length;
    s().addSellerItem(pin);
    expect(s().project!.sellerItems).toEqual([pin]);
    expect(s().project!.items[0].design.sellerItems).toBeUndefined();
    expect(s().projectPast.length).toBe(past + 1);
    s().setProjectSellerItemQuantity('regency', 'PIN-5', 3);
    expect(s().project!.sellerItems).toEqual([{ ...pin, quantity: 3 }]);
    s().setProjectSellerItemQuantity('regency', 'PIN-5', 0);
    expect(s().project!.sellerItems ?? []).toEqual([]);
    s().undoProject();
    expect(s().project!.sellerItems).toEqual([{ ...pin, quantity: 3 }]);
  });
});

describe('Brands from the decor list (ADR-210, G-044)', () => {
  const decor = (maker: Decor['maker'], code: string, makerText = '', thickness = 18): Decor => ({
    id: `${maker}:${code}:${thickness}`,
    maker,
    makerText: makerText || maker,
    kind: 'pal',
    code,
    name: `Decor ${code}`,
    thickness,
    color: '#cccccc',
    list: 'decors.csv',
  });
  const list = [
    decor('egger', 'W1000', 'Egger'),
    decor('kronospan', 'K001', 'Kronospan'),
    decor('egger', 'H1145', 'EGGER'),
    decor('other', 'X1', 'Acme Boards'),
    decor('other', 'X2', ' acme boards '),
    decor('other', 'Z9', 'Zeta'),
  ];

  it('one brand per manufacturer, other rows by their written maker, decors by code', () => {
    const bs = decorBrands(list);
    expect(bs.map((b) => [b.label, b.decors.length])).toEqual([
      ['Acme Boards', 2],
      ['Egger', 2],
      ['Kronospan', 1],
      ['Zeta', 1],
    ]);
    expect(bs.find((b) => b.label === 'Egger')!.decors.map((d) => d.code)).toEqual([
      'H1145',
      'W1000',
    ]);
    expect(decorBrands([])).toEqual([]);
  });

  it('a saved piece uses a brand when it has a board of that maker', () => {
    const bs = decorBrands(list);
    const egger = bs.find((b) => b.label === 'Egger')!;
    const acme = bs.find((b) => b.label === 'Acme Boards')!;
    const d = tpl('base-door');
    expect(usesBrand(d, egger)).toBe(false);
    const withEgger = {
      ...d,
      materials: d.materials.map((m, i) => (i === 0 ? { ...m, maker: 'egger' as const } : m)),
    };
    expect(usesBrand(withEgger, egger)).toBe(true);
    const withAcme = {
      ...d,
      materials: d.materials.map((m, i) =>
        i === 0
          ? {
              ...m,
              maker: 'other' as const,
              decor: { code: 'X1', name: 'Decor X1', color: '#ccc' },
            }
          : m,
      ),
    } as Design;
    expect(usesBrand(withAcme, acme)).toBe(true);
    expect(usesBrand(withAcme, egger)).toBe(false);
  });
});

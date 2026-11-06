// ADR-206: prints, exports and seller matching — seller products on fastener and run part lines (saved, priced and
// reloaded), the project's `runProducts` field (schemaVersion 21), the price change summary for the Seller prices
// workflow, and formula functions. The client sheet and the SVG download are in `prints-exports-ui.test.tsx`.
import 'fake-indexeddb/auto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { cutlist, hardwareSummary } from '../src/core/cutlist';
import { templates, upgradeDesign, validateDesign } from '../src/core/design';
import { fastenerCounts, fastenerProductKey } from '../src/core/fasteners';
import { estimate, linePrice, runUnitFits } from '../src/core/prices';
import {
  makeItem,
  newProject,
  planRuns,
  PROJECT_SCHEMA,
  PROJECT_SCHEMAS,
  projectCutlist,
  validateProject,
  type Project,
} from '../src/core/project';
import {
  productIndex,
  refOf,
  runPartOffers,
  sellerPriceLookup,
  type SellerCatalog,
  type SellerProduct,
} from '../src/core/sellers';
import { withHardwareProduct } from '../src/core/sellers/choices';
import { runPartKey, shoppingList, type ShopLine } from '../src/core/shopping';
import type { Design, HardwareProduct } from '../src/core/types';
import {
  addVariable,
  evaluateExpr,
  evaluateVariables,
  FUNCTIONS,
  isFunctionName,
  nameProblem,
  tokenize,
  updateVariable,
} from '../src/core/variables';
import { db, loadDesign, loadProject, saveDesign, saveProject } from '../src/persist/db';
import { useDesign } from '../src/store/designStore';
import { MAX_LINES, priceChanges } from '../tools/sellers/price-changes.mjs';

const product = (
  p: Partial<SellerProduct> & Pick<SellerProduct, 'id' | 'n' | 'k'>,
): SellerProduct => ({ c: '', p: 1000, u: 'piece', s: 'in', x: '', ...p });
const catalog = (products: SellerProduct[], extracted = '2026-10-29'): SellerCatalog => ({
  id: 'shop',
  name: 'Shop',
  origin: 'https://shop.example',
  imageBase: 'https://shop.example/img/',
  currency: 'RON',
  priceNote: 'VAT included',
  extracted,
  products,
});
const CATS = [
  catalog([
    product({ id: 'screw', n: 'Surub 4x40 (buc)', k: 'other', p: 15 }),
    product({ id: 'wt', n: 'Blat 4100 x 600 x 38', k: 'worktop', p: 50000, t: 38 }),
    product({ id: 'plinth-m', n: 'Plinta bucatarie (m)', k: 'other', p: 2500, u: 'm' }),
    product({ id: 'wt-m2', n: 'Blat la m2', k: 'worktop', p: 9000, u: 'm2' }),
    product({ id: 'b18', n: 'Pal alb 18', k: 'board', t: 18 }),
  ]),
];
const lookup = sellerPriceLookup(productIndex(CATS));
const link = (id: string, per = 1): HardwareProduct => {
  const p = CATS[0].products.find((x) => x.id === id)!;
  return { ...refOf({ seller: CATS[0], p }), per };
};
const tpl = (id: string) => upgradeDesign(templates.find((t) => t.id === id)!.create());

// ---------------------------------------------------------------------------------------------------------------
// Fastener lines (G-314): Design.hardwareProducts under `fs:<joint>`
// ---------------------------------------------------------------------------------------------------------------

const designShop = (d: Design): ShopLine[] => {
  const model = buildModel(d);
  return shoppingList({
    rows: cutlist(model, d.materials),
    materials: d.materials,
    hardware: hardwareSummary(model),
    sheets: new Map(d.materials.map((m) => [m.id, 2])),
    fasteners: { counts: fastenerCounts(model), choices: [] },
    hardwareProducts: d.hardwareProducts,
    sellerItems: d.sellerItems,
  });
};
const carcassLine = (lines: ShopLine[]) =>
  lines.find((l) => l.productKey === fastenerProductKey('carcass-joint'))!;

describe('fastener lines take a seller product (ADR-206, G-314)', () => {
  beforeEach(async () => {
    await db.designs.clear();
  });
  it('a fastener line offers a product under fs:<joint>; linked, it moves to Hardware and is priced per piece', () => {
    const d0 = tpl('chest');
    const before = carcassLine(designShop(d0));
    expect(fastenerProductKey('carcass-joint')).toBe('fs:carcass-joint');
    expect(before.section).toBe('choose');
    expect(before.product).toBeUndefined();
    expect(linePrice(before, new Map(), lookup)).toBeNull();

    const d = withHardwareProduct(d0, before.productKey!, link('screw', 2));
    expect(d.hardwareProducts).toEqual({ 'fs:carcass-joint': link('screw', 2) });
    const after = carcassLine(designShop(d));
    expect(after.section).toBe('hardware');
    expect(after.priceKey).toBe('fs:carcass-joint');
    expect(after.product).toEqual({ seller: 'shop', id: 'screw', name: 'Surub 4x40 (buc)' });
    // joints × seller units per item × price per piece
    expect(linePrice(after, new Map(), lookup)).toBe(before.quantity * 2 * 15);
    const e = estimate(designShop(d), [], lookup);
    expect(e.sellers).toEqual(['Shop, 2026-10-29']);
    expect(e.missing).not.toContain(after.label);
  });

  it('a counted fastener line (the user named a fastener) keeps its section and takes the product', () => {
    const d = withHardwareProduct(tpl('chest'), 'fs:carcass-joint', link('screw'));
    const model = buildModel(d);
    const lines = shoppingList({
      rows: cutlist(model, d.materials),
      materials: d.materials,
      hardware: hardwareSummary(model),
      sheets: null,
      fasteners: {
        counts: fastenerCounts(model),
        choices: [{ joint: 'carcass-joint', name: 'Confirmat 7x50', per: 2 }],
      },
      hardwareProducts: d.hardwareProducts,
    });
    const l = lines.find((x) => x.label === 'Confirmat 7x50')!;
    expect(l.section).toBe('hardware');
    expect(l.productKey).toBe('fs:carcass-joint');
    expect(l.product?.id).toBe('screw');
    expect(linePrice(l, new Map(), lookup)).toBe(l.quantity * 15);
  });

  it('the link saves with the design, survives JSON and reloads from the device; unlink removes it', async () => {
    const d = withHardwareProduct(tpl('chest'), 'fs:carcass-joint', link('screw', 3));
    expect(validateDesign(JSON.parse(JSON.stringify(d)))).toEqual([]);
    await saveDesign(d);
    const back = (await loadDesign(d.id))!;
    expect(back.hardwareProducts?.['fs:carcass-joint']).toEqual(link('screw', 3));
    expect(carcassLine(designShop(back)).section).toBe('hardware');
    expect(withHardwareProduct(back, 'fs:carcass-joint', undefined).hardwareProducts).toBe(
      undefined,
    );
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Run parts (G-314): Project.runProducts, schemaVersion 21
// ---------------------------------------------------------------------------------------------------------------

/** Two base cabinets with the automatic run parts (a worktop and a cover panel). */
function run(): Project {
  let p = newProject('Run');
  for (let i = 0; i < 2; i++) {
    const it = makeItem(p, tpl('base-door'));
    p = { ...p, items: [...p.items, it] };
  }
  const q = { ...p, runSettings: { scribe: 0, auto: true } };
  return { ...q, runParts: planRuns(q).parts };
}
const worktopOf = (p: Project) => p.runParts!.find((r) => r.kind === 'worktop')!;
/** The run part keys the estimate prices by their product: those whose seller unit fits (useEstimate). */
const pricedKeys = (p: Project) =>
  new Set(
    Object.entries(p.runProducts ?? {})
      .filter(([, v]) => {
        const sp = lookup(v);
        return !!sp && runUnitFits(sp.unit);
      })
      .map(([k]) => k),
  );
const projectShop = (p: Project): ShopLine[] =>
  shoppingList({
    rows: projectCutlist(p),
    materials: [],
    hardware: [],
    sheets: null,
    runParts: p.runParts,
    runProducts: p.runProducts,
    runPriced: pricedKeys(p),
  });
const runRowCount = (p: Project, id: string) =>
  projectCutlist(p)
    .flatMap((r) => r.panelIds)
    .filter((x) => x === `run:${id}`).length;

describe('run part lines take a seller product (ADR-206, G-314)', () => {
  beforeEach(async () => {
    await db.projects.clear();
  });
  it('run parts exist and each line carries its key; worktops get worktops first', () => {
    const p = run();
    const wt = worktopOf(p);
    expect(p.runParts!.map((r) => r.kind)).toEqual(expect.arrayContaining(['worktop', 'cover']));
    const line = projectShop(p).find((l) => l.section === 'run' && l.label === wt.label)!;
    expect(line.runKey).toBe(runPartKey(wt));
    expect(line.runKey).toBe(wt.key);
    expect(line.priceKey).toBeUndefined();
    expect(line.detail).toMatch(/counted under Boards/);
    expect(runPartOffers(CATS, true)[0].p.k).toBe('worktop');
    expect(runPartOffers(CATS, false)[0].p.k).toBe('board');
  });

  it('per piece: the worktop is priced by its product and leaves its board line', () => {
    const p0 = run();
    const wt = worktopOf(p0);
    expect(runRowCount(p0, wt.id)).toBe(1);
    const p = { ...p0, runProducts: { [runPartKey(wt)]: link('wt') } };
    const lines = projectShop(p);
    const line = lines.find((l) => l.runKey === runPartKey(wt))!;
    expect(line.priceKey).toBe(`run:${runPartKey(wt)}`);
    expect(line.product?.id).toBe('wt');
    expect(line.detail).toMatch(/priced by its product/);
    expect(linePrice(line, new Map(), lookup)).toBe(50000);
    // The worktop's part is no longer on a board line, so it is not bought twice.
    const area = (ls: ShopLine[]) =>
      ls.filter((l) => l.section === 'boards').reduce((n, l) => n + (l.m2 ?? 0), 0);
    const wtArea = (wt.box.w * wt.box.d) / 1e6;
    expect(area(projectShop(p0)) - area(lines)).toBeCloseTo(wtArea, 2);
    // Linked but not priced (no catalog loaded yet): the part stays with its board.
    const unpriced = shoppingList({
      rows: projectCutlist(p),
      materials: [],
      hardware: [],
      sheets: null,
      runParts: p.runParts,
      runProducts: p.runProducts,
    });
    expect(area(unpriced)).toBeCloseTo(area(projectShop(p0)), 6);
    expect(unpriced.find((l) => l.runKey === runPartKey(wt))?.priceKey).toBeUndefined();
    const before = projectCutlist(p0).reduce((n, r) => n + r.quantity, 0);
    // The cut list itself is untouched (the part is still cut); only the shopping list drops it from its board.
    expect(projectCutlist(p).reduce((n, r) => n + r.quantity, 0)).toBe(before);
  });

  it('per metre: a cover panel is priced by its length; m² or packs keep it with its board', () => {
    const p0 = run();
    const cover = p0.runParts!.find((r) => r.kind === 'cover')!;
    const key = runPartKey(cover);
    const p = { ...p0, runProducts: { [key]: link('plinth-m', 1) } };
    const line = projectShop(p).find((l) => l.runKey === key)!;
    const m = Math.max(cover.box.w, cover.box.h, cover.box.d) / 1000;
    expect(line.lengthM).toBe(m);
    expect(linePrice(line, new Map(), lookup)).toBe(Math.round(m * 2500));

    expect(runUnitFits('piece')).toBe(true);
    expect(runUnitFits('m')).toBe(true);
    expect(runUnitFits('m2')).toBe(false);
    expect(runUnitFits('pack')).toBe(false);
    const wt = worktopOf(p0);
    const q = { ...p0, runProducts: { [runPartKey(wt)]: link('wt-m2') } };
    const l2 = projectShop(q).find((l) => l.runKey === runPartKey(wt))!;
    expect(l2.product?.id).toBe('wt-m2');
    expect(l2.priceKey).toBeUndefined();
    expect(l2.detail).toMatch(/counted under Boards/);
  });

  it('the store links and unlinks a run part product; it saves and reloads with the project', async () => {
    const p0 = run();
    const key = runPartKey(worktopOf(p0));
    useDesign.getState().openProject(p0);
    useDesign.getState().setRunProduct(key, link('wt'));
    let p = useDesign.getState().project!;
    expect(p.runProducts).toEqual({ [key]: link('wt') });
    expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual([]);
    await saveProject(p);
    const back = (await loadProject(p.id))!;
    expect(back.runProducts).toEqual({ [key]: link('wt') });
    expect(projectShop(back).find((l) => l.runKey === key)?.priceKey).toBe(`run:${key}`);
    useDesign.getState().setRunProduct(key, undefined);
    p = useDesign.getState().project!;
    expect(p.runProducts).toBeUndefined();
  });
});

describe('project schemaVersion 21 (ADR-206, ADR-011)', () => {
  it('21 validates runProducts; 20 with runProducts is refused; every older version still loads', () => {
    expect(PROJECT_SCHEMA).toBe(21);
    expect(PROJECT_SCHEMAS).toContain(20);
    const p0 = run();
    const key = runPartKey(worktopOf(p0));
    const p = { ...p0, runProducts: { [key]: link('wt', 2) } };
    expect(validateProject(p)).toEqual([]);
    expect(validateProject({ ...p, schemaVersion: 20 })).toContain(
      'Run part products need project schemaVersion 21',
    );
    // A file of every older version without the field loads unchanged.
    const plain = newProject('Old');
    for (const v of PROJECT_SCHEMAS)
      expect(validateProject({ ...plain, schemaVersion: v }), `v${v}`).toEqual([]);
    expect(validateProject({ ...p0, schemaVersion: 20 })).toEqual([]);
    // Bad values are refused, never thrown.
    expect(validateProject({ ...p, runProducts: [] })).toContain('Invalid run part products');
    expect(
      validateProject({
        ...p,
        runProducts: { [key]: { seller: 'shop', id: 'wt', name: 'x', per: 0 } },
      }),
    ).toContain(`Invalid run part product for ${key}`);
    expect(validateProject({ ...p, runProducts: { [key]: { seller: 'shop' } } })).toContain(
      `Invalid run part product for ${key}`,
    );
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Price change summary (G-340)
// ---------------------------------------------------------------------------------------------------------------

describe('tools/sellers/price-changes.mjs (ADR-206, G-340)', () => {
  const previous = catalog(
    [
      product({ id: 'a', n: 'Pal alb 18', k: 'board', p: 10000, code: 'P18' }),
      product({ id: 'b', n: 'Balama | aplicata', k: 'hinge', p: 200 }),
      product({ id: 'c', n: 'Cant ABS', k: 'edge-band', p: 300, u: 'm' }),
      product({ id: 'same', n: 'Picior', k: 'leg', p: 700 }),
      product({ id: 'gone', n: 'Glisiera veche', k: 'runner', p: 4000 }),
    ],
    '2026-10-01',
  );
  const next = catalog(
    [
      product({ id: 'a', n: 'Pal alb 18', k: 'board', p: 11000, code: 'P18' }),
      product({ id: 'b', n: 'Balama | aplicata', k: 'hinge', p: 150 }),
      product({ id: 'c', n: 'Cant ABS', k: 'edge-band', p: 300, u: 'piece' }),
      product({ id: 'same', n: 'Picior', k: 'leg', p: 700 }),
      product({ id: 'new1', n: 'Maner nou', k: 'handle', p: 900 }),
      product({ id: 'new2', n: 'Surub', k: 'other', p: 5 }),
    ],
    '2026-11-01',
  );
  it('counts changed, new and dropped products and lists changed lines old → new with %', () => {
    const md = priceChanges(previous, next);
    expect(md).toContain('### Shop: price changes');
    expect(md).toContain('Export 2026-10-01 → 2026-11-01 (RON).');
    expect(md).toContain('- Changed prices: 3');
    expect(md).toContain('- New products: 2');
    expect(md).toContain('- Dropped products: 1');
    expect(md).toContain('| Pal alb 18 | P18 | 100.00 / piece | 110.00 / piece | +10.0 % |');
    // Pipes in names are escaped; the largest change comes first.
    expect(md).toContain('| Balama \\| aplicata |  | 2.00 / piece | 1.50 / piece | -25.0 % |');
    expect(md).toContain('| Cant ABS |  | 3.00 / m | 3.00 / piece | unit changed |');
    expect(md).not.toContain('Picior');
    const rows = md.split('\n').filter((l) => l.startsWith('| ') && !/^\| (Product|---)/.test(l));
    expect(rows.map((r) => r.split(' | ')[0])).toEqual([
      '| Cant ABS',
      '| Balama \\| aplicata',
      '| Pal alb 18',
    ]);
    expect(md).not.toContain('more');
  });
  it(`lists at most ${MAX_LINES} changed lines, then "… and N more"`, () => {
    expect(MAX_LINES).toBe(50);
    const many = (k: number) =>
      catalog(
        Array.from({ length: 60 }, (_, i) =>
          product({
            id: `p${i}`,
            n: `Item ${String(i).padStart(2, '0')}`,
            k: 'other',
            p: 100 + k * (i + 1),
          }),
        ),
      );
    const md = priceChanges(many(0), many(1));
    expect(md).toContain('- Changed prices: 60');
    expect(md.split('\n').filter((l) => /^\| Item/.test(l))).toHaveLength(50);
    expect(md).toContain('… and 10 more');
  });
  it('the command line writes the Markdown file from two catalog files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'price-changes-'));
    writeFileSync(join(dir, 'prev.json'), JSON.stringify(previous));
    writeFileSync(join(dir, 'next.json'), JSON.stringify(next));
    const out = join(dir, 'out.md');
    execFileSync(process.execPath, [
      'tools/sellers/price-changes.mjs',
      join(dir, 'prev.json'),
      join(dir, 'next.json'),
      out,
    ]);
    expect(readFileSync(out, 'utf8')).toBe(priceChanges(previous, next));
    // Without an output file it prints to stdout.
    const printed = execFileSync(process.execPath, [
      'tools/sellers/price-changes.mjs',
      join(dir, 'prev.json'),
      join(dir, 'next.json'),
    ]).toString();
    expect(printed).toBe(priceChanges(previous, next));
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Formula functions (G-324)
// ---------------------------------------------------------------------------------------------------------------

describe('formula functions (ADR-206, G-324)', () => {
  const scope = new Map([
    ['width', 600],
    ['height', 720],
  ]);
  it('min, max, floor, ceil and round evaluate; values inside a call are split by , or ;', () => {
    for (const f of ['min', 'max', 'floor', 'ceil', 'round']) expect(FUNCTIONS[f]).toBeDefined();
    expect(evaluateExpr('min(width, height)', scope)).toEqual({ raw: 600 });
    expect(evaluateExpr('max(width; height; 700)', scope)).toEqual({ raw: 720 });
    expect(evaluateExpr('MAX(1, 2, 3, 4)', scope)).toEqual({ raw: 4 });
    expect(evaluateExpr('floor(1000 / 3)', scope)).toEqual({ raw: 333 });
    expect(evaluateExpr('ceil(1000 / 3)', scope)).toEqual({ raw: 334 });
    expect(evaluateExpr('round(2.5)', scope)).toEqual({ raw: 3 });
    expect(evaluateExpr('round(width / 7)', scope)).toEqual({ raw: 86 });
    expect(evaluateExpr('min(width, max(100, 200)) + 18', scope)).toEqual({ raw: 218 });
    expect(evaluateExpr('2 × floor(height / 100)', scope)).toEqual({ raw: 14 });
    // Inside a call a decimal takes a point; outside one a comma still reads as a decimal.
    expect(evaluateExpr('max(1.5, 1.25)', scope)).toEqual({ raw: 1.5 });
    expect(evaluateExpr('1,5 + 1', scope)).toEqual({ raw: 2.5 });
  });
  it('wrong value counts and unclosed calls are diagnostics, never throws', () => {
    expect(evaluateExpr('min(400)', scope)).toMatchObject({
      problem: '“min” takes at least 2 values.',
    });
    expect(evaluateExpr('max()', scope)).toMatchObject({
      problem: '“max” takes at least 2 values.',
    });
    expect(evaluateExpr('floor(1, 2)', scope)).toMatchObject({
      problem: '“floor” takes exactly 1 value.',
    });
    expect(evaluateExpr('ceil()', scope)).toMatchObject({
      problem: '“ceil” takes exactly 1 value.',
    });
    expect(evaluateExpr('round(1, 2, 3)', scope)).toMatchObject({
      problem: /“round” takes at most \d values\./,
    });
    expect(evaluateExpr('min(1, 2', scope)).toMatchObject({ problem: /not closed/ });
    // A variable chain with a bad call reports the problem and keeps no value.
    const ev = evaluateVariables([{ id: 'a', name: 'a', expr: 'min(5)' }]);
    expect(ev.get('a')?.value).toBeUndefined();
    expect(ev.get('a')?.problem).toMatch(/at least 2 values/);
  });
  it('the five names are refused for new and renamed variables; a stored one still loads and reads as a variable', () => {
    for (const n of ['min', 'max', 'floor', 'ceil', 'round', 'Round']) {
      expect(isFunctionName(n)).toBe(true);
      expect(nameProblem(n)).toBe(`“${n}” is the name of a formula function; pick another name.`);
    }
    expect(nameProblem('minimum')).toBeNull();
    expect(nameProblem('round', [], false)).toBeNull();

    // A project saved before the functions, with a variable named "round": it validates and still reads.
    let p = newProject('Old names');
    p = addVariable(p, 'round', '400').project;
    p = addVariable(p, 'top', 'round + 18').project;
    p = addVariable(p, 'mix', 'round(round / 3) + max(round, 10)').project;
    expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual([]);
    const ev = evaluateVariables(p.variables!);
    const val = (name: string) => ev.get(p.variables!.find((v) => v.name === name)!.id)?.value;
    expect(val('round')).toBe(400);
    expect(val('top')).toBe(418);
    // `round(` is a call even with a variable of that name; `round` alone is the variable.
    expect(val('mix')).toBe(133 + 400);
    const tk = tokenize('round(round)', ['round']);
    expect('tokens' in tk && tk.tokens.map((x) => x.kind)).toEqual(['fn', 'op', 'name', 'op']);
    // Renaming another variable to a function name is refused by the same check the UI uses.
    const top = p.variables!.find((v) => v.name === 'top')!;
    expect(
      nameProblem(
        'floor',
        p.variables!.filter((v) => v.id !== top.id),
      ),
    ).toMatch(/name of a formula function/);
    // A rename to a free name still follows into formulas.
    const renamed = updateVariable(p, top.id, { name: 'top height' });
    expect(renamed.variables!.find((v) => v.id === top.id)!.name).toBe('top height');
  });
});

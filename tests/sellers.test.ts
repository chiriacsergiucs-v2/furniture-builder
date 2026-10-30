// ADR-161: bundled seller catalogs, matching products to boards, bands and hardware, links in the design, and
// seller prices in the estimate.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { cutlist, hardwareSummary } from '../src/core/cutlist';
import { SCHEMA_VERSION, templates, upgradeDesign, validateDesign } from '../src/core/design';
import { estimate, linePrice, priceSource, type PriceEntry } from '../src/core/prices';
import { makeItem, newProject } from '../src/core/project';
import {
  bandFromOffer,
  bandOffers,
  boardOffers,
  boardPatch,
  hardwareOffers,
  loadSellerCatalogs,
  productIndex,
  refOf,
  sellerPriceLookup,
  shortName,
  type SellerCatalog,
  type SellerProduct,
} from '../src/core/sellers';
import {
  projectSellerChoices,
  projectWithHardwareProduct,
  withHardwareProduct,
  withSellerItem,
  withSellerItemQuantity,
} from '../src/core/sellers/choices';
import { shoppingList, type ShopLine } from '../src/core/shopping';
import type { Design, Material } from '../src/core/types';

const KINDS = new Set([
  'board',
  'worktop',
  'edge-band',
  'hinge',
  'runner',
  'push-latch',
  'flap-stay',
  'shelf-pin',
  'wall-bracket',
  'handle',
  'leg',
  'other',
]);

const product = (
  p: Partial<SellerProduct> & Pick<SellerProduct, 'id' | 'n' | 'k'>,
): SellerProduct => ({
  c: '',
  p: 1000,
  u: 'piece',
  s: 'in',
  x: '',
  ...p,
});
const catalog = (products: SellerProduct[]): SellerCatalog => ({
  id: 'shop',
  name: 'Shop',
  origin: 'https://shop.example',
  imageBase: 'https://shop.example/img/',
  currency: 'RON',
  priceNote: 'VAT included',
  extracted: '2026-10-29',
  products,
});
const white: Material = {
  id: 'w',
  name: 'PAL 18 white',
  thickness: 18,
  grain: true,
  color: '#ffffff',
  sheet: { length: 2800, width: 2070, trim: 12, count: 3 },
};
const CATS = [
  catalog([
    product({
      id: 'b16',
      n: 'Pal melaminat alb 16, 2800 x 2070 x 16 mm',
      k: 'board',
      c: 'Pal melaminat uni',
      t: 16,
      l: 2800,
      w: 2070,
    }),
    product({
      id: 'b18',
      n: 'Pal melaminat Egger alb W1000, 2800 x 2070 x 18 mm',
      k: 'board',
      c: 'Pal melaminat uni',
      m: 'Egger',
      t: 18,
      l: 2800,
      w: 2070,
      code: 'P18EG.W1000',
    }),
    product({
      id: 'b18out',
      n: 'Pal alb 18 out',
      k: 'board',
      c: 'Pal melaminat uni',
      t: 18,
      s: 'out',
    }),
    product({
      id: 'band19',
      n: 'CANT ABS alb 19/0.4',
      k: 'edge-band',
      b: 'abs',
      t: 4,
      w: 19,
      u: 'm',
    }),
    product({
      id: 'band22',
      n: 'CANT ABS alb 22/0.8',
      k: 'edge-band',
      b: 'abs',
      t: 8,
      w: 22,
      u: 'm',
      code: 'C22',
    }),
    product({
      id: 'band43d',
      n: 'CANT ABS EGGER W1000, 43/2 mm',
      k: 'edge-band',
      b: 'abs',
      t: 20,
      w: 43,
      u: 'm',
    }),
    product({ id: 'band-no-size', n: 'CANT PVC alb', k: 'edge-band', b: 'pvc', u: 'm' }),
    product({ id: 'r350', n: 'Glisiera 350', k: 'runner', L: 350 }),
    product({ id: 'r400', n: 'Glisiera 400', k: 'runner', L: 400, p: 5000 }),
    product({ id: 'rnone', n: 'Glisiera accesoriu', k: 'runner' }),
    product({ id: 'h1', n: 'Balama aplicata', k: 'hinge', p: 250 }),
    product({ id: 'pack', n: 'Balama (10 buc)', k: 'hinge', u: 'pack' }),
    product({ id: 'leg', n: 'Picior', k: 'leg', p: 700 }),
  ]),
];

describe('bundled Regency catalog (converter output)', () => {
  const data = JSON.parse(readFileSync('src/core/sellers/regency.json', 'utf8')) as SellerCatalog;
  it('keeps every product of the export with a kind, a unit and a whole price', () => {
    expect(data.products).toHaveLength(7495);
    expect(new Set(data.products.map((p) => p.id)).size).toBe(7495);
    expect(data.origin).toBe('https://regencycompany.ro');
    expect(data.imageBase.startsWith(data.origin + '/')).toBe(true);
    for (const p of data.products) {
      expect(KINDS.has(p.k)).toBe(true);
      expect(['piece', 'm', 'm2', 'pack', 'set']).toContain(p.u);
      expect(Number.isSafeInteger(p.p) && p.p >= 0).toBe(true);
      for (const v of [p.t, p.w, p.l, p.L])
        if (v !== undefined) expect(Number.isSafeInteger(v)).toBe(true);
    }
  });
  it('states sizes only as the seller does (no guessed sizes)', () => {
    const b = data.products.find((p) => p.code === 'P18KR.112.PE')!;
    expect([b.k, b.t, b.l, b.w]).toEqual(['board', 18, 2800, 2070]);
    const band = data.products.find((p) => p.code === '1786523')!;
    expect([band.k, band.b, band.t, band.w, band.u]).toEqual(['edge-band', 'abs', 20, 43, 'm']);
    const runner = data.products.find((p) => p.code === '230M2500.21')!;
    expect([runner.k, runner.L, runner.t]).toEqual(['runner', 250, undefined]);
  });
  it('loads through the lazy loader', async () => {
    const cats = await loadSellerCatalogs();
    expect(cats.map((c) => c.id)).toEqual(['regency']);
    expect(
      boardOffers(cats, white, 'kronospan').every((o) => /kronospan/i.test(o.p.n + (o.p.m ?? ''))),
    ).toBe(true);
  });
});

describe('matching (ADR-161)', () => {
  it('boards: the board thickness first, in stock before out of stock', () => {
    const ids = boardOffers(CATS, white).map((o) => o.p.id);
    expect(ids).toEqual(['b18', 'b18out', 'b16']);
    expect(boardOffers(CATS, white, 'egger w1000').map((o) => o.p.id)).toEqual(['b18']);
  });
  it('board pick sets only the seller values; grain, colour, trim and stock count stay', () => {
    const o = boardOffers(CATS, white)[0];
    const m = { ...white, ...boardPatch(o, white) };
    expect(m.name).toBe('Pal melaminat Egger alb W1000');
    expect(m.thickness).toBe(18);
    expect(m.sheet).toEqual({ length: 2800, width: 2070, trim: 12, count: 3 });
    expect([m.maker, m.kind, m.grain, m.color]).toEqual(['egger', 'pal', true, '#ffffff']);
    expect(m.product).toEqual({ seller: 'shop', id: 'b18', name: o.p.n });
    // A product with no stated sizes leaves thickness and sheet alone.
    const bare = boardPatch(
      { seller: CATS[0], p: product({ id: 'x', n: 'Placa', k: 'board' }) },
      white,
    );
    expect(bare.thickness).toBeUndefined();
    expect(bare.sheet).toBeUndefined();
    expect(bare.maker).toBeUndefined();
    expect(shortName('PAL x, 2800 x 2070 x 18 mm')).toBe('PAL x');
  });
  it('bands: at least as wide as the board, same decor code first, then narrowest', () => {
    const egger = { ...white, name: 'Pal Egger alb W1000' };
    expect(bandOffers(CATS, egger).map((o) => o.p.id)).toEqual(['band43d', 'band19', 'band22']);
    expect(bandOffers(CATS, { ...white, thickness: 20 }).map((o) => o.p.id)).toEqual([
      'band22',
      'band43d',
    ]);
  });
  it('band pick sets type, thickness, width, code; the allowance stays', () => {
    const o = bandOffers(CATS, white).find((x) => x.p.id === 'band22')!;
    expect(bandFromOffer(o, { kind: 'pvc', thickness: 4, width: 20, allowance: 30 })).toEqual({
      kind: 'abs',
      thickness: 8,
      width: 22,
      code: 'C22',
      allowance: 30,
      product: refOf(o),
    });
    expect(
      bandFromOffer({ seller: CATS[0], p: CATS[0].products.find((p) => p.id === 'band-no-size')! }),
    ).toBeNull();
  });
  it('hardware: the line kind first, the same runner length first, then no stated length', () => {
    const ids = hardwareOffers(CATS, 'drawer-runner-pair', 400).map((o) => o.p.id);
    expect(ids.slice(0, 3)).toEqual(['r400', 'rnone', 'r350']);
    expect(ids).not.toContain('b18');
    expect(ids).not.toContain('band22');
    expect(hardwareOffers(CATS, 'hinge', undefined)[0].p.k).toBe('hinge');
  });
});

const chest = () => upgradeDesign(templates.find((t) => t.id === 'chest')!.create());
const shop = (d: Design): ShopLine[] => {
  const model = buildModel(d);
  return shoppingList({
    rows: cutlist(model, d.materials),
    materials: d.materials,
    hardware: hardwareSummary(model),
    sheets: new Map(d.materials.map((m) => [m.id, 2])),
    hardwareProducts: d.hardwareProducts,
    sellerItems: d.sellerItems,
  });
};
const lookup = sellerPriceLookup(productIndex(CATS));
const offer = (id: string) => ({ seller: CATS[0], p: CATS[0].products.find((p) => p.id === id)! });

describe('design links (ADR-161)', () => {
  it('validate, survive JSON, and need schemaVersion 5; older versions still load', () => {
    expect(SCHEMA_VERSION).toBe(6);
    let d = chest();
    const runner = shop(d).find((l) => l.hardwareKind === 'drawer-runner-pair')!;
    d = withHardwareProduct(d, runner.productKey!, { ...refOf(offer('r400')), per: 2 });
    d = withSellerItem(d, { ...refOf(offer('leg')), quantity: 4 });
    d = {
      ...d,
      materials: d.materials.map((m, i) => (i === 0 ? { ...m, product: refOf(offer('b18')) } : m)),
    };
    const back = JSON.parse(JSON.stringify(d)) as Design;
    expect(validateDesign(back)).toEqual([]);
    expect(back.hardwareProducts?.[runner.productKey!]?.per).toBe(2);
    expect(validateDesign({ ...back, schemaVersion: 4 })).toContain(
      'Seller products need schemaVersion 5',
    );
    expect(validateDesign({ ...chest(), schemaVersion: 4 })).toEqual([]);
    expect(
      validateDesign({
        ...back,
        hardwareProducts: { k: { seller: 's', id: 'i', name: 'n', per: 0 } },
      }),
    ).not.toEqual([]);
    expect(
      validateDesign({
        ...back,
        sellerItems: [{ seller: 's', id: 'i', name: 'n', quantity: 1.5 }],
      }),
    ).not.toEqual([]);
    expect(
      validateDesign({
        ...back,
        materials: back.materials.map((m) => ({ ...m, product: { seller: 's' } })),
      }),
    ).not.toEqual([]);
  });
  it('items: the same product adds up; 0 removes', () => {
    let d = withSellerItem(chest(), { ...refOf(offer('leg')), quantity: 4 });
    d = withSellerItem(d, { ...refOf(offer('leg')), quantity: 2 });
    expect(d.sellerItems).toEqual([{ ...refOf(offer('leg')), quantity: 6 }]);
    expect(withSellerItemQuantity(d, 0, 0).sellerItems).toBeUndefined();
  });
  it('a project gathers its pieces: first link per line, items times copies', () => {
    const a = withSellerItem(chest(), { ...refOf(offer('leg')), quantity: 4 });
    let p = newProject('P');
    p = { ...p, items: [{ ...makeItem(p, a), quantity: 2 }, makeItem(p, a)] };
    p = projectWithHardwareProduct(p, 'hw:x', { ...refOf(offer('h1')), per: 1 });
    const c = projectSellerChoices(p);
    expect(c.sellerItems[0].quantity).toBe(12);
    expect(c.hardwareProducts['hw:x'].id).toBe('h1');
    expect(p.items.every((i) => i.design.hardwareProducts?.['hw:x'])).toBe(true);
  });
});

describe('seller prices in the estimate (ADR-161)', () => {
  const linked = () => {
    let d = chest();
    const runner = shop(d).find((l) => l.hardwareKind === 'drawer-runner-pair')!;
    d = withHardwareProduct(d, runner.productKey!, { ...refOf(offer('r400')), per: 2 });
    d = withSellerItem(d, { ...refOf(offer('leg')), quantity: 4 });
    d = withSellerItem(d, { ...refOf(offer('pack')), quantity: 1 });
    const carcass = buildModel(d).panels.find((p) => p.role === 'side')!.materialId;
    d = {
      ...d,
      materials: d.materials.map((m) =>
        m.id === carcass ? { ...m, product: refOf(offer('b18')) } : m,
      ),
    };
    return shop(d);
  };
  it('per sheet for a board, × seller units per item for hardware, per piece for items', () => {
    const lines = linked();
    const map = new Map<string, PriceEntry>();
    const board = lines.find((l) => l.section === 'boards' && l.product)!;
    expect(linePrice(board, map, lookup)).toBe(2 * 1000);
    const runner = lines.find((l) => l.hardwareKind === 'drawer-runner-pair')!;
    expect(linePrice(runner, map, lookup)).toBe(runner.quantity * 2 * 5000);
    const leg = lines.find((l) => l.label === 'Picior')!;
    expect(linePrice(leg, map, lookup)).toBe(4 * 700);
    expect(priceSource(leg, map, lookup)).toBe('seller');
  });
  it('the user’s own price wins; packs, sets and unknown products stay missing', () => {
    const lines = linked();
    const leg = lines.find((l) => l.label === 'Picior')!;
    const own: PriceEntry = { id: leg.priceKey!, unit: 'piece', amount: 100 };
    expect(linePrice(leg, new Map([[own.id, own]]), lookup)).toBe(400);
    expect(priceSource(leg, new Map([[own.id, own]]), lookup)).toBe('own');
    const pack = lines.find((l) => l.label === 'Balama (10 buc)')!;
    expect(linePrice(pack, new Map(), lookup)).toBeNull();
    const gone = { ...leg, product: { seller: 'shop', id: 'nope', name: 'x' } };
    expect(linePrice(gone, new Map(), lookup)).toBeNull();
    const e = estimate(lines, [own], lookup);
    expect(e.missing).toContain('Balama (10 buc)');
    expect(e.fromSeller).toBeGreaterThanOrEqual(2);
    expect(e.sellers).toEqual(['Shop, 2026-10-29']);
  });
  it('a hardware line still to choose moves to Hardware once a product is linked', () => {
    const lines = shoppingList({
      rows: [],
      materials: [],
      hardware: [{ nodeId: 'n', kind: 'flap-stay', label: 'Lift-up stay', quantity: 2 }],
      sheets: null,
      hardwareProducts: { 'hw:Lift-up stay': { ...refOf(offer('h1')), per: 1 } },
    });
    expect(lines[0].section).toBe('hardware');
    expect(linePrice(lines[0], new Map(), lookup)).toBe(500);
    const unlinked = shoppingList({
      rows: [],
      materials: [],
      hardware: [{ nodeId: 'n', kind: 'flap-stay', label: 'Lift-up stay', quantity: 2 }],
      sheets: null,
    });
    expect([unlinked[0].section, unlinked[0].productKey]).toEqual(['choose', 'hw:Lift-up stay']);
  });
});

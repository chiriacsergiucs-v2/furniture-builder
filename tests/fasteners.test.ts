import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { hardwareSummary } from '../src/core/cutlist';
import { frameDefaults, templates, wrap } from '../src/core/design';
import {
  fastenerCounts,
  fastenerShopLines,
  projectFastenerCounts,
  type FastenerCount,
  type JointType,
} from '../src/core/fasteners';
import { parsePricesCsv } from '../src/core/prices';
import { makeItem, newProject, type RunPart } from '../src/core/project';
import { shoppingList } from '../src/core/shopping';
import type { Design } from '../src/core/types';
import {
  db,
  deleteFastener,
  listFasteners,
  listPrices,
  saveFastener,
  savePrice,
} from '../src/persist/db';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const asRecord = (cs: FastenerCount[]) =>
  Object.fromEntries(cs.map((c) => [c.joint, c.count])) as Record<JointType, number>;

/**
 * Hand counts (ADR-074), one row per template. Carcass joints: each place one carcass board's edge or face meets
 * another's face (side–top, side–bottom, each end of a fixed shelf, each end of a divider, side to side where two
 * carcasses meet). Shelf pins and hanging brackets: as scheduled. Backs, worktops: one each. Foot: a piece on a plinth.
 */
const HAND: Record<string, Record<JointType, number>> = {
  // 2 sides × (top + bottom)
  chest: c(4, 0, 1, 0, 0, 1),
  // 4 + 4 fixed shelves × 2 ends
  bookcase: c(12, 0, 1, 0, 0, 1),
  // 4 + 1 fixed shelf × 2
  'base-door': c(6, 0, 1, 0, 0, 1),
  // 4 + 2 dividers × (top + bottom) + 2 shelves × (side + divider)
  sideboard: c(12, 0, 1, 0, 0, 1),
  // 4 + fixed shelf (side + divider) + divider (top + bottom) + 5 shelves × 2
  wardrobe: c(18, 0, 1, 0, 0, 1),
  // 4 + 1 shelf × 2; two hanging brackets; no plinth
  'wall-cabinet': c(6, 0, 1, 2, 0, 0),
  // two carcasses 4 + 4, shelf 2, the two touching sides 1
  'corner-blind': c(11, 0, 2, 0, 0, 1),
  // main carcass 4 + shelf 2; wing: side–top, side–bottom, side–shelf 3 (butted edges are not joints)
  'corner-l': c(9, 0, 2, 0, 0, 1),
  // loose panels: their screws are the panel set's own
  panels: c(0, 0, 0, 0, 0, 0),
  // pedestal 4 + modesty to gable and to the pedestal side 2; one desk top
  'desk-pedestal': c(6, 0, 1, 0, 1, 0),
  // modesty to both gables
  'desk-gables': c(2, 0, 0, 0, 1, 0),
};
function c(j: number, pin: number, back: number, hang: number, top: number, foot: number) {
  return {
    'carcass-joint': j,
    'shelf-pin': pin,
    'back-fixing': back,
    'hanging-point': hang,
    'worktop-fixing': top,
    foot,
  };
}

describe('fastener counts from the model (ADR-074)', () => {
  it('match the hand counts for every template', () => {
    for (const tpl of templates) {
      expect(HAND[tpl.id], `hand count for ${tpl.id}`).toBeDefined();
      expect(asRecord(fastenerCounts(buildModel(tpl.create()))), tpl.id).toEqual(HAND[tpl.id]);
    }
  });

  it('adjustable shelves are on pins (4 each), not carcass joints', () => {
    const d = t('bookcase');
    if (d.product.kind !== 'cabinet') throw new Error('cabinet expected');
    const adj: Design = {
      ...d,
      product: {
        ...d.product,
        params: {
          ...d.product.params,
          interior: { ...d.product.params.interior, adjustable: true } as never,
        },
      },
    };
    const r = asRecord(fastenerCounts(buildModel(adj)));
    expect(r['carcass-joint']).toBe(4);
    expect(r['shelf-pin']).toBe(16);
  });

  it('frame furniture: legs, rails and slats are joinery, not carcass joints', () => {
    for (const kind of ['table', 'bench', 'stool', 'chair', 'bed'] as const) {
      const m = buildModel(wrap('f', { kind: 'frame', id: 'F', params: frameDefaults(kind) }));
      expect(asRecord(fastenerCounts(m))['carcass-joint'], kind).toBe(0);
    }
  });

  it('a project adds each piece times its quantity, plus worktops that are run parts', () => {
    let p = newProject('Kitchen');
    p = { ...p, items: [makeItem(p, t('base-door'))] };
    p = { ...p, items: [...p.items, { ...makeItem(p, t('wall-cabinet')), quantity: 3 }] };
    const worktop = {
      id: 'w1',
      kind: 'worktop',
      label: 'Worktop',
      reason: 'test',
      box: { x: 0, y: 720, z: 0, w: 2400, h: 38, d: 600 },
    } as RunPart;
    const r = projectFastenerCounts({ ...p, runParts: [worktop] });
    const rec = asRecord(r);
    expect(rec['carcass-joint']).toBe(6 + 3 * 6);
    expect(rec['hanging-point']).toBe(3 * 2);
    expect(rec['back-fixing']).toBe(1 + 3);
    expect(rec['worktop-fixing']).toBe(1);
    expect(r.find((x) => x.joint === 'worktop-fixing')!.lengthMm).toBe(2400);
    expect(rec.foot).toBe(1);
  });
});

describe('fastener lines in the shopping list (ADR-074)', () => {
  const counts = fastenerCounts(buildModel(t('wardrobe')));

  it('without a chosen fastener the count is "to choose before buying", labelled guidance', () => {
    const { lines } = fastenerShopLines(counts, []);
    const joint = lines.find((l) => l.label.startsWith('Joint fixings'))!;
    expect(joint.section).toBe('choose');
    expect(joint.label).toBe('Joint fixings: 18 joints — choose your fastener');
    expect(joint.quantity).toBe(18);
    expect(joint.detail).toMatch(/^Guidance: counted from the model/);
    expect(lines.every((l) => l.section === 'choose')).toBe(true);
    // Nothing counted, nothing listed.
    expect(lines.some((l) => l.label.startsWith('Hanging'))).toBe(false);
  });

  it('with a chosen fastener it is a counted hardware line; equal fasteners are combined', () => {
    const { lines } = fastenerShopLines(counts, [
      { joint: 'carcass-joint', name: 'Confirmat 7 × 50', per: 2 },
      { joint: 'back-fixing', name: 'Confirmat 7 × 50', per: 10 },
      { joint: 'foot', name: 'Adjustable foot', per: 4 },
    ]);
    const conf = lines.filter((l) => l.label === 'Confirmat 7 × 50');
    expect(conf).toHaveLength(1);
    expect(conf[0].section).toBe('hardware');
    expect(conf[0].quantity).toBe(18 * 2 + 1 * 10);
    expect(conf[0].detail).toBe('Guidance: counted from the model: 18 joints × 2; 1 back × 10.');
    expect(conf[0].priceKey).toBe('hw:Confirmat 7 × 50');
    expect(lines.find((l) => l.label === 'Adjustable foot')!.quantity).toBe(4);
    expect(lines.some((l) => l.section === 'choose')).toBe(false);
  });

  it('a choice the app cannot use is ignored, never clamped', () => {
    const { lines } = fastenerShopLines(counts, [
      { joint: 'carcass-joint', name: 'Dowel', per: 0 },
      { joint: 'foot', name: '  ', per: 4 },
    ]);
    expect(lines.find((l) => l.label.startsWith('Joint fixings'))!.section).toBe('choose');
    expect(lines.find((l) => l.label.startsWith('Feet'))!.section).toBe('choose');
  });

  it('shelf pins stay as scheduled until the user names theirs, which then replaces them', () => {
    const d = t('bookcase');
    if (d.product.kind !== 'cabinet') throw new Error('cabinet expected');
    const adj: Design = {
      ...d,
      product: {
        ...d.product,
        params: {
          ...d.product.params,
          interior: { ...d.product.params.interior, adjustable: true } as never,
        },
      },
    };
    const m = buildModel(adj);
    const cs = fastenerCounts(m);
    const base = { rows: [], materials: [], hardware: hardwareSummary(m), sheets: null };
    const before = shoppingList({ ...base, fasteners: { counts: cs, choices: [] } });
    expect(before.filter((l) => /shelf pin/i.test(l.label)).map((l) => l.section)).toEqual([
      'hardware',
    ]);
    const after = shoppingList({
      ...base,
      fasteners: { counts: cs, choices: [{ joint: 'shelf-pin', name: 'Pin 5 mm brass', per: 1 }] },
    });
    expect(after.some((l) => l.label === 'Shelf pin, 5 mm')).toBe(false);
    expect(after.find((l) => l.label === 'Pin 5 mm brass')!.quantity).toBe(16);
  });
});

describe('the fastener list on the device (ADR-074)', () => {
  it('is saved in the prices table without showing up as prices; a price file cannot overwrite it', async () => {
    await db.prices.clear();
    await savePrice({ id: 'hw:Hinge', unit: 'piece', amount: 250 });
    await saveFastener({ joint: 'carcass-joint', name: 'Dowel 8 × 35', per: 3 });
    // A row the app cannot read is skipped and kept (ADR-012).
    await db.prices.put({ id: 'fastener:foot', unit: 'piece', amount: 0 });
    expect(await listFasteners()).toEqual([
      { joint: 'carcass-joint', name: 'Dowel 8 × 35', per: 3 },
    ]);
    expect((await listPrices()).map((p) => p.id)).toEqual(['hw:Hinge']);
    expect(await db.prices.get('fastener:foot')).toBeDefined();
    await deleteFastener('carcass-joint');
    expect(await listFasteners()).toEqual([]);
    const r = parsePricesCsv('key;unit;price\nfastener:foot;piece;1\n');
    expect(r.prices).toEqual([]);
    expect(r.problems[0]).toMatch(/not a price/);
  });
});

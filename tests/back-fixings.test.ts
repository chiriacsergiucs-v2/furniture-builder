/**
 * Back fixing drilling positions (G-439): round each back's perimeter, from the edge distance and spacing the user
 * typed; nothing drawn until both are typed (ADR-010), exact whole-mm splits (ADR-003), saved in the existing fastener
 * row (no Dexie version).
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { templates } from '../src/core/design';
import {
  backFixingPositions,
  fixingNote,
  validFastenerChoice,
  type FastenerChoice,
} from '../src/core/fasteners';
import { setPrintLang } from '@furniture-builder/i18n/print';
import { drillingRo } from '../src/core/ro';
import type { Panel } from '../src/core/types';
import { db, deleteFastener, listFasteners, saveFastener } from '../src/persist/db';

const tpl = (id: string) => templates.find((x) => x.id === id)!.create();
const back = (edge?: number, spacing?: number): FastenerChoice => ({
  joint: 'back-fixing',
  name: 'My pins',
  per: 12,
  ...(edge !== undefined ? { edge } : {}),
  ...(spacing !== undefined ? { spacing } : {}),
});
/** A plain back panel u × v on the x/y plane. */
const panel = (w: number, h: number, extra: Partial<Panel> = {}): Panel =>
  ({
    id: 'b1',
    nodeId: 'n',
    role: 'back',
    name: 'Back',
    materialId: 'm',
    box: { x: 0, y: 0, z: 0, w, h, d: 3 },
    thicknessAxis: 'z',
    grainAxis: 'y',
    edges: [],
    ...extra,
  }) as unknown as Panel;

describe('back fixing drilling positions (G-439)', () => {
  it('nothing without a back-fixing choice with both edge and spacing typed', () => {
    const model = buildModel(tpl('chest'));
    expect(backFixingPositions(model, undefined).parts.size).toBe(0);
    expect(backFixingPositions(model, back()).parts.size).toBe(0);
    expect(backFixingPositions(model, back(20)).parts.size).toBe(0);
    expect(backFixingPositions(model, back(undefined, 150)).parts.size).toBe(0);
    expect(
      backFixingPositions(model, {
        joint: 'carcass-joint',
        name: 'x',
        per: 2,
        edge: 20,
        spacing: 150,
      }).parts.size,
    ).toBe(0);
  });

  it('a fixing at each corner of the line edge in, the ones between no more than spacing apart, exact mm', () => {
    // 600 × 400 back, 20 in: lines 560 and 360 long. 560 / 150 → 4 gaps of 140; 360 / 150 → 3 gaps of 120.
    const { parts, notDrawn } = backFixingPositions({ panels: [panel(600, 400)] }, back(20, 150));
    expect(notDrawn).toBe(0);
    const p = parts.get('b1')!;
    expect([p.u, p.v]).toEqual([600, 400]);
    const bottom = [20, 160, 300, 440, 580].map((x) => [x, 20]);
    const top = [20, 160, 300, 440, 580].map((x) => [x, 380]);
    const sides = [140, 260].flatMap((y) => [
      [20, y],
      [580, y],
    ]);
    expect(p.at).toEqual([...bottom, ...top, ...sides]);
    // No position twice; corners included once.
    expect(new Set(p.at.map(([u, v]) => `${u}/${v}`)).size).toBe(p.at.length);
  });

  it('uneven lengths split exactly, the spare millimetres first; gaps never exceed spacing', () => {
    // 563 − 40 = 523 in 4 gaps (≤ 150): 131, 131, 131, 130.
    const p = backFixingPositions({ panels: [panel(563, 100)] }, back(20, 150)).parts.get('b1')!;
    expect(p.at.filter(([, v]) => v === 20).map(([u]) => u)).toEqual([20, 151, 282, 413, 543]);
    // 100 − 40 = 60 ≤ 150: corners only, no side positions between them.
    expect(p.at.filter(([u]) => u === 20).map(([, v]) => v)).toEqual([20, 80]);
    for (const [u, v] of p.at) expect(Number.isInteger(u) && Number.isInteger(v)).toBe(true);
  });

  it('a back with no room inside the edge distance, or not a rectangle, gets none and is counted', () => {
    const r = backFixingPositions(
      {
        panels: [
          panel(600, 40),
          { ...panel(600, 400), id: 'b2', shape: { kind: 'x' } } as unknown as Panel,
          { ...panel(600, 400), id: 'b3' },
        ],
      },
      back(20, 150),
    );
    expect(r.notDrawn).toBe(2);
    expect([...r.parts.keys()]).toEqual(['b3']);
  });

  it('every template back gets positions on its own face, labelled guidance, printed in ro, ru and en', () => {
    const model = buildModel(tpl('chest'));
    const backs = model.panels.filter((p) => p.role === 'back');
    expect(backs.length).toBeGreaterThan(0);
    const { parts } = backFixingPositions(model, back(15, 200), 'item:');
    for (const b of backs) {
      const p = parts.get(`item:${b.id}`)!;
      expect(p).toBeDefined();
      for (const [u, v] of p.at)
        expect(u >= 15 && u <= p.u - 15 && v >= 15 && v <= p.v - 15).toBe(true);
      const note = fixingNote(p);
      expect(note).not.toMatch(/Ø|diameter|depth|screw|deep/i);
      setPrintLang('ro');
      expect(drillingRo(note)).toMatch(/^găuri de fixare la .* mm, orientativ, din valorile tale$/);
      setPrintLang('ru');
      expect(drillingRo(note)).toMatch(/по вашим значениям$/);
      setPrintLang('en');
      expect(drillingRo(note)).toMatch(/guidance from your values$/);
    }
    setPrintLang('ro');
  });

  it('the choice validates spacing as whole mm 1–5000 and is saved in the existing prices row', async () => {
    expect(validFastenerChoice(back(20, 150))).toBe(true);
    expect(validFastenerChoice(back())).toBe(true);
    expect(validFastenerChoice(back(20, 0))).toBe(false);
    expect(validFastenerChoice(back(20, 5001))).toBe(false);
    expect(validFastenerChoice(back(20, 1.5))).toBe(false);
    const version = db.verno;
    await saveFastener(back(20, 150));
    expect((await listFasteners()).find((c) => c.joint === 'back-fixing')).toEqual(back(20, 150));
    expect(await db.prices.get('fastener:back-fixing')).toMatchObject({
      text: 'My pins',
      per: 12,
      edge: 20,
      spacing: 150,
    });
    await saveFastener(back(20));
    expect((await listFasteners()).find((c) => c.joint === 'back-fixing')).toEqual(back(20));
    expect(db.verno).toBe(version);
    await deleteFastener('back-fixing');
  });
});

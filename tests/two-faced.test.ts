// Open both sides (ADR-292): rear edge banding, the free-standing fixing and the schemaVersion 11 field.
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import {
  SCHEMA_VERSION,
  splitSpace,
  templates,
  upgradeDesign,
  validateDesign,
} from '../src/core/design';
import type { CabinetParams, Design, Space } from '../src/core/types';

/** A 1800 mm bookcase with one divider and shelves, with the given back and Open both sides. */
function bookcase(back: CabinetParams['back'], twoFaced?: true, version = SCHEMA_VERSION): Design {
  const d = templates.find((t) => t.id === 'bookcase')!.create();
  if (d.product.kind !== 'cabinet') throw Error('not a cabinet');
  const split = splitSpace({ id: 'root', kind: 'empty' }, 'x', 2);
  if (split.kind !== 'split') throw Error('not a split');
  const interior: Space = {
    ...split,
    children: split.children.map((c) => ({ ...c, kind: 'shelves', count: 3 }) as Space),
  };
  const params: CabinetParams = {
    ...d.product.params,
    back,
    interior,
    ...(twoFaced ? { twoFaced } : {}),
  };
  return { ...d, schemaVersion: version, product: { ...d.product, params } } as Design;
}

const CARCASS = new Set(['side', 'top', 'bottom', 'divider', 'shelf']);

describe('Open both sides (ADR-292)', () => {
  it('bands every side, top, bottom, divider and shelf on its front and rear edge', () => {
    const m = buildModel(bookcase('none', true));
    const parts = m.panels.filter((p) => CARCASS.has(p.role));
    expect(new Set(parts.map((p) => p.role))).toEqual(CARCASS);
    for (const p of parts) expect(p.banded, p.id).toEqual(expect.arrayContaining(['+z', '-z']));
  });

  it('Back None without Open both sides keeps the front-only banding', () => {
    const m = buildModel(bookcase('none'));
    expect(m.panels.filter((p) => p.banded.includes('-z'))).toEqual([]);
    for (const p of m.panels.filter((x) => CARCASS.has(x.role))) expect(p.banded).toContain('+z');
  });

  it('schedules the free-standing fixing instead of the wall fixing above the anti-tip height', () => {
    const labels = (d: Design) => buildModel(d).hardware.map((h) => h.label);
    expect(labels(bookcase('none', true))).toContain('Free-standing fixing: floor or ceiling');
    expect(labels(bookcase('none', true))).not.toContain('Anti-tip wall fixing');
    expect(labels(bookcase('none'))).toContain('Anti-tip wall fixing');
    const fix = buildModel(bookcase('none', true)).hardware.find((h) => h.kind === 'floor-fixing');
    expect(fix?.quantity).toBe(1);
  });

  it('needs schemaVersion 11 and no back; version 10 designs still load', () => {
    expect(SCHEMA_VERSION).toBe(15);
    expect(validateDesign(bookcase('none', true))).toEqual([]);
    expect(validateDesign(bookcase('applied', true))).toContain(
      'Open both sides needs a piece with no back',
    );
    expect(validateDesign(bookcase('none', true, 10))).toContain(
      'Open both sides needs schemaVersion 11',
    );
    const v10 = bookcase('none', undefined, 10);
    expect(validateDesign(v10)).toEqual([]);
    expect(upgradeDesign(v10).schemaVersion).toBe(15);
    const bad = bookcase('none');
    if (bad.product.kind !== 'cabinet') throw Error();
    const wrong = {
      ...bad,
      product: { ...bad.product, params: { ...bad.product.params, twoFaced: false } },
    };
    expect(validateDesign(wrong)).toContain('Open both sides needs a piece with no back');
  });
});

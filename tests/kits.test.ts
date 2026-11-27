// Kits (ADR-298): a version inserted as a pre-made build keeps only its size and boards open; Unlock all edits removes
// the lock in one step and Undo brings it back; the lock is a schemaVersion 12 field.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { catalogFamilies, insertVariant } from '../src/core/catalog';
import { SCHEMA_VERSION, upgradeDesign, validateDesign } from '../src/core/design';
import { kitBlocked, unlockKit } from '../src/core/kit';
import type { Design } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

/** The Room divider's Tall version, inserted as a kit. */
function divider(): Design {
  const f = catalogFamilies.find((x) => x.id === 'room-divider')!;
  return insertVariant(
    f,
    f.variants.find((v) => v.id === 'room-divider-tall')!,
  )!;
}

const st = () => useDesign.getState();
const params = () => {
  const p = st().design.product;
  if (p.kind !== 'cabinet') throw Error('not a cabinet');
  return p.params;
};

describe('Kits (ADR-298)', () => {
  beforeEach(() => st().load(divider()));

  it('inserts a kit version with the lock on size and boards', () => {
    expect(st().design.catalog?.kit).toEqual({ allow: ['size', 'boards'] });
  });

  it('allows a size change and rewrites the staggered rows', () => {
    st().updateCabinet({ width: 1500 });
    expect(params().width).toBe(1500);
    expect(st().design.catalog?.kit).toBeTruthy();
  });

  it('allows a board change', () => {
    const other = st().design.materials.find((m) => m.id !== params().bodyMaterialId);
    if (!other) return;
    st().updateCabinet({ bodyMaterialId: other.id });
    expect(params().bodyMaterialId).toBe(other.id);
  });

  it('refuses a structure change with a notice', () => {
    const before = JSON.stringify(st().design.product);
    st().updateCabinet({ plinthHeight: 100 });
    expect(st().notice).toBe('Locked in a kit. Unlock all edits to change it.');
    expect(JSON.stringify(st().design.product)).toBe(before);
  });

  it('Unlock all edits removes the kit in one step, and Undo brings it back', () => {
    st().unlockKit();
    expect(st().design.catalog?.kit).toBeUndefined();
    st().updateCabinet({ plinthHeight: 100 });
    expect(params().plinthHeight).toBe(100);
    st().undo();
    expect(st().design.catalog?.kit).toBeUndefined();
    st().undo();
    expect(st().design.catalog?.kit).toEqual({ allow: ['size', 'boards'] });
  });

  it('kitBlocked and unlockKit are pure', () => {
    const d = divider();
    if (d.product.kind !== 'cabinet') throw Error();
    const at = (patch: object) =>
      ({ ...d, product: { ...d.product, params: { ...d.product.params, ...patch } } }) as Design;
    expect(kitBlocked(d, at({ height: 1900 }))).toBeNull();
    expect(kitBlocked(d, at({ back: 'applied' }))).toMatch(/kit/);
    expect(kitBlocked(d, unlockKit(d))).toBeNull();
    expect(unlockKit(d).catalog?.kit).toBeUndefined();
    const plain = unlockKit(d);
    expect(kitBlocked(plain, at({ back: 'applied' }))).toBeNull();
  });

  it('needs schemaVersion 12; version 11 designs still load', () => {
    expect(SCHEMA_VERSION).toBe(13);
    const d = divider();
    expect(validateDesign(d)).toEqual([]);
    expect(validateDesign({ ...d, schemaVersion: 11 })).toContain('A kit needs schemaVersion 12');
    expect(
      validateDesign({
        ...d,
        catalog: { ...d.catalog!, kit: { allow: ['legs'] } },
      } as unknown as Design),
    ).toContain('Invalid kit');
    const v11 = { ...unlockKit(d), schemaVersion: 11 as const };
    expect(validateDesign(v11)).toEqual([]);
    expect(upgradeDesign(v11).schemaVersion).toBe(13);
  });
});

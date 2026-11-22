import { describe, expect, it } from 'vitest';
import { catalogFamilies, insertable } from '../src/core/catalog';
import { mergeCatalog } from '../src/core/catalog/local';
import type { Offer } from '../src/core/sellers';
import {
  finderFamilies,
  finderRooms,
  finderTypes,
  NO_FILTER,
  offerKinds,
  offersOfKind,
} from '../src/ui/catalogFinder';
import { parseCatalogFinder } from '../src/store/useCatalogFinder';

// ADR-291: the catalog finder's pure rules.
const families = mergeCatalog(catalogFamilies, []);

describe('catalog finder', () => {
  it('lists each family once with no filter', () => {
    const shown = finderFamilies(families, NO_FILTER);
    expect(shown).toHaveLength(families.length);
    expect(new Set(shown.map((f) => f.id)).size).toBe(shown.length);
  });

  it('keeps only the families of a room and of a type', () => {
    const room = finderRooms(families)[0]!;
    expect(
      finderFamilies(families, { ...NO_FILTER, room }).every((f) => f.rooms.includes(room)),
    ).toBe(true);
    const fn = finderTypes(families)[0]!;
    const typed = finderFamilies(families, { ...NO_FILTER, fn });
    expect(typed.length).toBeGreaterThan(0);
    expect(typed.every((f) => f.function === fn)).toBe(true);
  });

  it('keeps only families with an item that opens right away when Ready is on', () => {
    const ready = finderFamilies(families, { ...NO_FILTER, ready: true });
    expect(ready.every((f) => f.variants.some(insertable))).toBe(true);
  });

  it('searches names', () => {
    const name = families[0]!.name.toLowerCase();
    expect(finderFamilies(families, { ...NO_FILTER, q: name }).map((f) => f.id)).toContain(
      families[0]!.id,
    );
    expect(finderFamilies(families, { ...NO_FILTER, q: 'zzzz-no-such-thing' })).toEqual([]);
  });

  it('keeps product kinds in first-seen order and filters by kind', () => {
    const o = (k: Offer['p']['k']) => ({ p: { k } }) as Offer;
    const list = [o('hinge'), o('board'), o('hinge')];
    expect(offerKinds(list)).toEqual(['hinge', 'board']);
    expect(offersOfKind(list, 'hinge')).toHaveLength(2);
    expect(offersOfKind(list, '')).toHaveLength(3);
  });

  it('is off unless on is stored', () => {
    expect(parseCatalogFinder(null)).toBe(false);
    expect(parseCatalogFinder('off')).toBe(false);
    expect(parseCatalogFinder('on')).toBe(true);
  });
});

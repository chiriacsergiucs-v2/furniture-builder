import 'fake-indexeddb/auto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDictionary, setLang, tr } from '@furniture-builder/i18n';
import { data_catalog } from '@furniture-builder/i18n/ru/data-catalog';
import { data_parts } from '@furniture-builder/i18n/ru/data-parts';
import { data_wizard } from '@furniture-builder/i18n/ru/data-wizard';
import { categoryLabel, FUNCTION_LABEL, FUNCTIONS, functionLabel } from '../src/core/catalog';
import { upgradeDesign, validateDesign } from '../src/core/design';
import { toDesign } from '../src/core/wizard/engine';
import { loadDesign, saveDesign } from '../src/persist/db';

// G-547 (display-only mapping, user 2026-11-27): stored category labels stay byte-identical; only the shown text maps.
beforeAll(() => loadDictionary('ru'));
afterAll(() => setLang('en'));

describe('stored category labels (G-547)', () => {
  it('keeps the stored English category after save and load', async () => {
    for (const fn of FUNCTIONS) {
      const d = toDesign({ type: 'cabinet', name: 'Piece', category: fn })!;
      expect(d.catalog?.category).toBe(FUNCTION_LABEL[fn]);
      // File export and import: the JSON text round trip.
      const back = upgradeDesign(JSON.parse(JSON.stringify(d)));
      expect(validateDesign(back)).toEqual([]);
      expect(back.catalog?.category).toBe(FUNCTION_LABEL[fn]);
      // Device storage.
      await saveDesign(d);
      expect((await loadDesign(d.id))?.catalog?.category).toBe(FUNCTION_LABEL[fn]);
    }
    expect(FUNCTION_LABEL.seating).toBe('Seating');
    expect(FUNCTION_LABEL.sleeping).toBe('Sleeping and lying');
  });

  it('shows one Russian wording for Seating and Sleeping and lying, wherever the label comes from', () => {
    setLang('ru');
    expect(functionLabel('seating')).toBe('Сиденья');
    expect(categoryLabel('Seating')).toBe('Сиденья');
    expect(tr('Seating')).toBe('Сиденья');
    expect(functionLabel('sleeping')).toBe('Сон и отдых');
    expect(categoryLabel('Sleeping and lying')).toBe('Сон и отдых');
    expect(tr('Sleeping and lying')).toBe('Сон и отдых');
    // A stored design name shows through the same lookup (Wardrobe, src/core/wizard/registry.ts).
    expect(tr('Wardrobe')).toBe('Шкаф для одежды');
    setLang('en');
    expect(functionLabel('seating')).toBe('Seating');
  });

  it('gives every function label exactly one Russian entry across the data tables', () => {
    const tables = [data_parts, data_catalog, data_wizard];
    for (const label of Object.values(FUNCTION_LABEL)) {
      const values = tables.filter((x) => Object.hasOwn(x, label)).map((x) => x[label]);
      expect(values, label).toHaveLength(1);
    }
  });
});

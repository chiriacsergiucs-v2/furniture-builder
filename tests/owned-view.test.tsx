// @vitest-environment jsdom
// Owned parts in the view (ADR-271): the cut list, its CSV and the sheet jobs leave them out; the estimate rows keep them.
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cutlistCsvRo } from '../src/core/ro';
import { templates } from '../src/core/design';
import { useDesign } from '../src/store/designStore';
import { useView } from '../src/store/useView';

const count = (rows: { quantity: number }[]) => rows.reduce((n, r) => n + r.quantity, 0);

describe('owned parts in the view (ADR-271)', () => {
  it('cutRows, the CSV and the sheet jobs drop the owned parts; rows keep them', () => {
    const d = templates.find((x) => x.id === 'bookcase')!.create();
    useDesign.getState().replaceDesign(d);
    const first = renderHook(() => useView()).result.current;
    const all = count(first.rows);
    const i = first.cutRows.findIndex((r) => r.quantity > 1);
    const key = first.owned.cutKeys[i]!;
    expect(useDesign.getState().setOwnedParts(key, 2)).toBeNull();

    const v = renderHook(() => useView()).result.current;
    expect(count(v.rows)).toBe(all);
    expect(count(v.cutRows)).toBe(all - 2);
    expect(v.owned.owned.reduce((n, e) => n + e.owned, 0)).toBe(2);
    const sheetParts = v
      .jobs()
      .flatMap((j) => j.parts)
      .reduce((n, p) => n + p.quantity, 0);
    expect(sheetParts).toBe(
      all - 2 - v.cutRows.filter((r) => r.solid).reduce((n, r) => n + r.quantity, 0),
    );
    // The CSV lists the rows to cut, not the owned ones.
    expect(cutlistCsvRo(v.cutRows)).not.toBe(cutlistCsvRo(v.rows));
    expect(useDesign.getState().design.ownedParts).toEqual({ [key]: 2 });

    // Not owned again: everything is back.
    useDesign.getState().setOwnedParts(key, 0);
    const back = renderHook(() => useView()).result.current;
    expect(count(back.cutRows)).toBe(all);
    expect(useDesign.getState().design.ownedParts).toBeUndefined();
  });
});

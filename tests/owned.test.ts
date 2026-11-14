// Parts the user already owns (ADR-267): taken off the cut list and the sheets only, across a project.
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { cutlist } from '../src/core/cutlist';
import { templates, validateDesign } from '../src/core/design';
import { nestingJobs } from '../src/core/nesting/fromDesign';
import { applyOwned, ownedKey, validOwned, withOwned } from '../src/core/owned';
import {
  makeItem,
  newProject,
  projectCutlist,
  buildProjectModel,
  validateProject,
} from '../src/core/project';
import type { Design } from '../src/core/types';

const make = (id: string): Design => templates.find((x) => x.id === id)!.create();
const parts = (rows: { quantity: number }[]) => rows.reduce((n, r) => n + r.quantity, 0);
const keyOf = (d: Design, rows = cutlist(buildModel(d), d.materials), i = 0) =>
  ownedKey(
    rows[i]!,
    d.materials.find((m) => m.id === rows[i]!.materialId)!,
  );

describe('owned parts (ADR-267)', () => {
  it('takes the owned count off the row, keeps the rest, and leaves the estimate rows alone', () => {
    const d = make('bookcase');
    const rows = cutlist(buildModel(d), d.materials);
    const i = rows.findIndex((r) => r.quantity > 1);
    expect(i).toBeGreaterThanOrEqual(0);
    const key = keyOf(d, rows, i);
    const split = applyOwned(rows, { [key]: 1 }, d.materials);
    expect(parts(split.cut)).toBe(parts(rows) - 1);
    expect(split.cut[i]!.quantity).toBe(rows[i]!.quantity - 1);
    expect(split.cut[i]!.panelIds).toEqual(rows[i]!.panelIds.slice(1));
    expect(split.owned).toEqual([{ row: rows[i], key, owned: 1 }]);
    expect(split.totals[key]).toBe(rows[i]!.quantity);
    expect(split.unmatched).toEqual([]);
    expect(split.cutKeys).toHaveLength(split.cut.length);
    // The rows themselves are not changed.
    expect(parts(rows)).toBe(parts(cutlist(buildModel(d), d.materials)));
  });

  it('removes a fully owned row, and keeps a mark that matches nothing (or too many) as unmatched', () => {
    const d = make('bookcase');
    const rows = cutlist(buildModel(d), d.materials);
    const key = keyOf(d, rows, 0);
    const all = applyOwned(rows, { [key]: rows[0]!.quantity + 2, 'gone|key': 3 }, d.materials);
    expect(all.cut.some((r) => r.panelIds[0] === rows[0]!.panelIds[0])).toBe(false);
    expect(all.unmatched).toEqual(
      expect.arrayContaining([
        { key, count: 2 },
        { key: 'gone|key', count: 3 },
      ]),
    );
  });

  it('one mark covers identical parts of several pieces in a project', () => {
    const d = make('bookcase');
    let p = newProject('Owned');
    p = { ...p, items: [makeItem(p, d), makeItem(p, d)] };
    const pm = buildProjectModel(p);
    const rows = projectCutlist(p, pm);
    const i = rows.findIndex((r) => r.quantity >= 4);
    expect(i).toBeGreaterThanOrEqual(0);
    const key = ownedKey(
      rows[i]!,
      pm.materials.find((m) => m.id === rows[i]!.materialId)!,
    );
    const split = applyOwned(rows, { [key]: 3 }, pm.materials);
    expect(parts(split.cut)).toBe(parts(rows) - 3);
    expect(validateProject({ ...p, ownedParts: { [key]: 3 } })).toEqual([]);
    expect(validateProject({ ...p, ownedParts: { [key]: 0 } })).not.toEqual([]);
  });

  it('sheets are laid out without the owned parts', () => {
    const d = make('bookcase');
    const model = buildModel(d);
    const rows = cutlist(model, d.materials);
    const key = keyOf(d, rows, 0);
    const split = applyOwned(rows, { [key]: rows[0]!.quantity }, d.materials);
    const all = nestingJobs(d, model)
      .jobs.flatMap((j) => j.parts)
      .reduce((n, x) => n + x.quantity, 0);
    const some = nestingJobs(d, model, split.cut)
      .jobs.flatMap((j) => j.parts)
      .reduce((n, x) => n + x.quantity, 0);
    expect(some).toBe(all - rows[0]!.quantity);
  });

  it('withOwned sets, replaces and clears; validOwned and validateDesign check the field', () => {
    expect(withOwned(undefined, 'a', 2)).toEqual({ a: 2 });
    expect(withOwned({ a: 2, b: 1 }, 'a', 0)).toEqual({ b: 1 });
    expect(withOwned({ a: 2 }, 'a', 0)).toBeUndefined();
    expect(validOwned({ a: 1 })).toBe(true);
    for (const bad of [[], { a: 0 }, { a: 1.5 }, { '': 1 }, { a: '1' }, null, 7])
      expect(validOwned(bad)).toBe(false);
    const d = make('bookcase');
    expect(validateDesign({ ...d, ownedParts: { a: 2 } })).toEqual([]);
    expect(validateDesign({ ...d, ownedParts: { a: -1 } })).not.toEqual([]);
    expect(validateDesign({ ...d, schemaVersion: 8, ownedParts: { a: 2 } })).not.toEqual([]);
  });
});

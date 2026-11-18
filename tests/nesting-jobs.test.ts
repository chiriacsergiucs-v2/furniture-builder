/**
 * The cut-list bridge to the nesting engine (ADR-018, ADR-279): one job per material from cut-list rows. The engine
 * itself is tested in packages/nesting/tests.
 */
import { describe, it, expect } from 'vitest';
import type { CutRow } from '../src/core/cutlist';
import { jobsFromCutlist, nest } from '../src/core/nesting';

const KERF = 4,
  TRIM = 10;
const PAL = { length: 2800, width: 2070 };
const MDF = { length: 2440, width: 1220 };

describe('jobsFromCutlist', () => {
  it('builds one job per material from cut-list rows', () => {
    const row = (
      materialId: string,
      panelIds: string[],
      labels: string[],
      length: number,
      width: number,
    ): CutRow => ({
      materialId,
      materialName: materialId.toUpperCase(),
      thickness: 18,
      length,
      width,
      quantity: panelIds.length,
      edgesL: 0,
      edgesW: 0,
      grain: materialId === 'pal',
      drilling: '',
      labels,
      panelIds,
    });
    const rows = [
      row('pal', ['s1', 's2'], ['Side L', 'Side R'], 720, 560),
      row('mdf', ['f1'], ['Front'], 700, 400),
      row('pal', ['t'], ['Top'], 800, 560),
      row('hdf', ['b'], ['Back'], 700, 700),
    ];
    const settings = new Map([
      ['pal', { sheet: { ...PAL, count: null }, trim: TRIM, kerf: KERF }],
      ['mdf', { sheet: { ...MDF, count: 2 }, trim: TRIM, kerf: KERF }],
    ]);
    const jobs = jobsFromCutlist(rows, settings);
    expect(jobs.map((j) => j.materialId)).toEqual(['pal', 'mdf']);
    expect(jobs[0].grain).toBe(true);
    expect(jobs[0].parts).toEqual([
      { key: 's1', label: 'Side L, Side R', length: 720, width: 560, quantity: 2 },
      { key: 't', label: 'Top', length: 800, width: 560, quantity: 1 },
    ]);
    expect(jobs.every((j) => nest(j).valid)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { nest } from '../src/core/nesting';
import {
  defaultOptimizerInput,
  optimizerJob,
  parseOptimizerInput,
  type OptimizerInput,
} from '../src/core/optimizer';

const input = (over: Partial<OptimizerInput> = {}): OptimizerInput => ({
  ...defaultOptimizerInput(),
  parts: [
    { id: 'a', label: 'Side', length: '720', width: '560', quantity: '2' },
    { id: 'b', label: '', length: '', width: '', quantity: '1' },
  ],
  ...over,
});

describe('cut list optimizer job', () => {
  it('starts from the PAL stock: 2800 × 2070, 4 mm kerf, 10 mm trim, grain locked', () => {
    const d = defaultOptimizerInput();
    expect([d.sheetLength, d.sheetWidth, d.kerf, d.trim, d.grain]).toEqual([
      '2800',
      '2070',
      '4',
      '10',
      true,
    ]);
  });

  it('builds a job from filled rows and ignores a blank row', () => {
    const c = optimizerJob(input());
    expect(c.problems).toEqual({});
    expect(c.filled).toBe(1);
    expect(c.job).toMatchObject({
      grain: true,
      sheet: { length: 2800, width: 2070, count: null },
      trim: 10,
      kerf: 4,
      parts: [{ key: 'a', label: 'Side', length: 720, width: 560, quantity: 2 }],
    });
    const r = nest(c.job!);
    expect(r.valid).toBe(true);
    expect(r.stats.sheetsUsed).toBe(1);
  });

  it('passes the grain lock through', () => {
    expect(optimizerJob(input({ grain: false })).job?.grain).toBe(false);
  });

  it('reports each wrong field and builds no job, never clamps', () => {
    const c = optimizerJob(
      input({
        sheetLength: '',
        kerf: '2.5',
        trim: '-1',
        parts: [{ id: 'a', label: '', length: '0', width: '500', quantity: 'x' }],
      }),
    );
    expect(c.job).toBeNull();
    expect(c.problems).toEqual({
      sheetLength: 'required',
      kerf: 'whole',
      trim: 'whole',
      'a.length': 'min',
      'a.quantity': 'whole',
    });
  });

  it('builds no job with no filled row', () => {
    const c = optimizerJob(input({ parts: [] }));
    expect(c.job).toBeNull();
    expect(c.filled).toBe(0);
  });

  it('reads back what it saved and rejects anything else', () => {
    const i = input();
    expect(parseOptimizerInput(JSON.stringify(i))).toEqual(i);
    expect(parseOptimizerInput(null)).toBeNull();
    expect(parseOptimizerInput('{bad')).toBeNull();
    expect(parseOptimizerInput(JSON.stringify({ ...i, grain: 'yes' }))).toBeNull();
    expect(parseOptimizerInput(JSON.stringify({ ...i, parts: [{ id: 1 }] }))).toBeNull();
  });
});

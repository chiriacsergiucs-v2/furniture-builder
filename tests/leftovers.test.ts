// ADR-302: a board's leftover pieces, saved with the design (schemaVersion 15) and filled before full sheets.
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { SCHEMA_VERSION, templates, upgradeDesign, validateDesign } from '../src/core/design';
import { nest } from '../src/core/nesting';
import { nestingJobs } from '../src/core/nesting/fromDesign';
import type { Design } from '../src/core/types';

const t = (id: string) => templates.find((x) => x.id === id)!.create();

const withLeftover = (d: Design, leftovers: unknown): Design =>
  ({
    ...d,
    materials: d.materials.map((m, i) => (i === 0 ? { ...m, leftovers } : m)),
  }) as Design;

describe('leftover sheets (ADR-302)', () => {
  it('validate in schemaVersion 15 and are refused in an older file', () => {
    expect(SCHEMA_VERSION).toBe(15);
    const d = upgradeDesign(t('bookcase'));
    expect(validateDesign(withLeftover(d, [{ length: 1200, width: 600 }]))).toEqual([]);
    expect(
      validateDesign(
        withLeftover({ ...d, schemaVersion: 14 }, [{ length: 1200, width: 600 }]),
      ).join(),
    ).toMatch(/leftovers need schemaVersion 15/);
    expect(validateDesign(withLeftover(d, [{ length: 0, width: 600 }])).join()).toMatch(
      /Invalid leftovers/,
    );
    expect(validateDesign(withLeftover(d, 'x')).join()).toMatch(/Invalid leftovers/);
    // A version-14 file without leftovers still loads.
    expect(validateDesign({ ...d, schemaVersion: 14 })).toEqual([]);
  });

  it('reach the layout, which fills them first; only full sheets are to buy', () => {
    const d0 = upgradeDesign(t('bookcase'));
    const m0 = d0.materials[0].id;
    const d = withLeftover(d0, [{ length: 2800, width: 2070 }]);
    const { jobs } = nestingJobs(d, buildModel(d));
    const job = jobs.find((j) => j.materialId === m0)!;
    expect(job.leftovers).toEqual([{ length: 2800, width: 2070 }]);
    const r = nest(job, { seed: 1, maxAttempts: 4 });
    expect(r.valid).toBe(true);
    expect(r.sheets[0].leftover).toBe(0);
    expect(r.stats.leftoversUsed).toBe(1);
    expect(r.stats.sheetsUsed - r.stats.leftoversUsed).toBe(r.sheets.length - 1);
  });
});

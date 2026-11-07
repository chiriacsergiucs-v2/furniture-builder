/**
 * Seeded golden layouts for the nesting engine (ADR-228, ADR-018). For a fixed set of jobs (the sample projects'
 * nesting jobs plus three synthetic ones) and seeds, every layout field except `search.elapsedMs` is pinned in
 * `tests/fixtures/nesting-golden.json`, computed with `maxMs: Infinity` so machine speed cannot change the result.
 * Any change to the packer shows up as a golden diff. After an intended heuristic change, regenerate with
 * `WRITE_NEST_GOLDEN=1 pnpm exec vitest run tests/nesting-golden.test.ts` and review the diff.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nest, validateNest } from '../src/core/nesting';
import type { NestJob, NestPart, NestResult } from '../src/core/nesting';
import { projectNestingJobs } from '../src/core/project';
import { sampleProjects } from './fixtures/mobila';

const SEEDS = [1, 7, 42];
const part = (key: string, length: number, width: number, quantity = 1): NestPart => ({
  key,
  label: key,
  length,
  width,
  quantity,
});
const base = (over: Partial<NestJob>): NestJob => ({
  materialId: 'pal18',
  materialName: 'PAL 18',
  thickness: 18,
  grain: false,
  sheet: { length: 2800, width: 2070, count: null },
  trim: 10,
  kerf: 4,
  parts: [],
  ...over,
});

/** Three synthetic jobs: mixed rotatable parts, a grained board, and limited stock with an oversized part. */
const SYNTHETIC: { name: string; job: NestJob }[] = [
  {
    name: 'synthetic-mixed',
    job: base({
      parts: [
        part('side', 720, 560, 6),
        part('shelf', 764, 540, 8),
        part('top', 1600, 560, 2),
        part('door', 716, 396, 10),
        part('strip', 2400, 100, 5),
      ],
    }),
  },
  {
    name: 'synthetic-grained',
    job: base({
      materialId: 'mdf-grain',
      materialName: 'MDF veneer',
      grain: true,
      sheet: { length: 2440, width: 1220, count: null },
      parts: [
        part('front', 1100, 450, 4),
        part('panel', 600, 300, 9),
        part('long', 2400, 200, 3),
        part('sq', 500, 500, 2),
      ],
    }),
  },
  {
    name: 'synthetic-limited',
    job: base({
      materialId: 'pal16',
      materialName: 'PAL 16',
      thickness: 16,
      sheet: { length: 2800, width: 2070, count: 1 },
      kerf: 3,
      parts: [
        part('big', 1388, 2050, 1),
        part('mid', 1000, 800, 4),
        part('huge', 3000, 500, 1),
        part('small', 300, 200, 12),
      ],
    }),
  },
];

const SAMPLE_JOBS = (): { name: string; job: NestJob }[] =>
  sampleProjects.flatMap((s) =>
    projectNestingJobs(s.create()).map((job) => ({ name: `${s.id}/${job.materialId}`, job })),
  );

/** Every field of a result except the wall-clock time. */
const pinned = (r: NestResult) => {
  const search: Partial<NestResult['search']> = { ...r.search };
  delete search.elapsedMs;
  return { ...r, search };
};

interface GoldenCase {
  name: string;
  job: NestJob;
  layouts: { seed: number; result: ReturnType<typeof pinned> }[];
}

const FIXTURE = new URL('./fixtures/nesting-golden.json', import.meta.url);
const compute = (cases: { name: string; job: NestJob }[]): GoldenCase[] =>
  cases.map(({ name, job }) => ({
    name,
    job,
    layouts: SEEDS.map((seed) => ({ seed, result: pinned(nest(job, { seed, maxMs: Infinity })) })),
  }));

if (process.env.WRITE_NEST_GOLDEN)
  writeFileSync(FIXTURE, `${JSON.stringify(compute([...SAMPLE_JOBS(), ...SYNTHETIC]), null, 2)}\n`);
const GOLDEN = JSON.parse(readFileSync(FIXTURE, 'utf8')) as GoldenCase[];

describe('nesting golden layouts (ADR-228)', () => {
  it('covers the sample projects and three synthetic jobs', () => {
    const names = GOLDEN.map((g) => g.name);
    expect(names.filter((n) => n.startsWith('synthetic-'))).toEqual(SYNTHETIC.map((s) => s.name));
    expect(names.filter((n) => !n.startsWith('synthetic-')).length).toBeGreaterThan(0);
    for (const s of sampleProjects) expect(names.some((n) => n.startsWith(`${s.id}/`))).toBe(true);
  });

  it('the sample projects still produce the pinned jobs', () => {
    const golden = GOLDEN.filter((g) => !g.name.startsWith('synthetic-'));
    expect(SAMPLE_JOBS()).toEqual(golden.map(({ name, job }) => ({ name, job })));
  });

  it('the synthetic jobs are the pinned jobs', () => {
    const golden = GOLDEN.filter((g) => g.name.startsWith('synthetic-'));
    expect(SYNTHETIC).toEqual(golden.map(({ name, job }) => ({ name, job })));
  });

  for (const g of GOLDEN)
    for (const { seed, result } of g.layouts)
      it(`${g.name}, seed ${seed}: same layout with maxMs Infinity, and validateNest accepts it`, () => {
        const r = nest(g.job, { seed, maxMs: Infinity });
        expect(pinned(r)).toEqual(result);
        expect(r.valid).toBe(true);
        expect(validateNest(g.job, result as NestResult)).toEqual([]);
      });
});

describe('production nesting default (ADR-228, ADR-018)', () => {
  afterEach(() => vi.restoreAllMocks());
  const job = SYNTHETIC[0].job;
  /** Clock: the first call (start) reads 0, every later call reads `later`. */
  const clockAt = (later: number) => {
    let first = true;
    vi.spyOn(performance, 'now').mockImplementation(() => (first ? ((first = false), 0) : later));
  };

  it('keeps searching while 1500 ms have not passed', () => {
    clockAt(1500);
    expect(nest(job).search.attempts).toBe(40);
  });

  it('stops after the first attempt once more than 1500 ms have passed', () => {
    clockAt(1501);
    expect(nest(job).search.attempts).toBe(1);
  });
});

/**
 * ADR-225 golden: every diagnostic (severity, code, message in English and Russian) the catalog variants, the design
 * templates and the sample projects give, plus squeezed and stretched copies of them so more checks fire. Written
 * before the codes were typed; a refactor must leave it byte-identical, except codes split on purpose (`SPLIT`).
 * `WRITE_GOLDEN=1 pnpm exec vitest run tests/diagnostic-golden.test.ts` rewrites the file.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { catalogFamilies, insertVariant } from '../src/core/catalog';
import { localClearances } from '../src/core/clearance';
import { templates } from '../src/core/design';
import { loadDictionary, setLang, type Lang } from '../src/core/i18n';
import { buildProjectModel, type Project } from '../src/core/project';
import type { RoomFeature } from '../src/core/room';
import type { Design, Diagnostic } from '../src/core/types';
import { sampleProjects } from './fixtures/mobila';

/**
 * Codes split on purpose by ADR-225 (one code per kind of problem): new code → the code the golden was written with.
 * Every other code, every severity and every message must match the golden exactly.
 */
const SPLIT: Record<string, string> = {
  'flap-small': 'door-small', // "Flap … is too small." was the door's code
  'drawer-heights-count': 'drawer-heights', // "Give one height per drawer" (the count), not "do not fit"
  'inset-doors-depth': 'space-too-small', // "No depth left behind the inset doors."
  'diagonal-proportion': 'corner-size', // "The diagonal needs the width … 300 mm more than the depth"
};

const NOW = '2026-11-07T00:00:00.000Z';

const sized = (d: Design, f: number): Design => {
  const c = structuredClone(d);
  const p = c.product.params as unknown as Record<string, unknown>;
  for (const k of ['width', 'height', 'depth'])
    if (typeof p[k] === 'number') p[k] = Math.round((p[k] as number) * f);
  return c;
};

function designs(): { id: string; d: Design }[] {
  const out: { id: string; d: Design }[] = [];
  for (const f of catalogFamilies)
    for (const v of f.variants) {
      const d = insertVariant(f, v, NOW);
      if (d) out.push({ id: `catalog:${f.id}/${v.id}`, d });
    }
  for (const t of templates) out.push({ id: `template:${t.id}`, d: t.create() });
  return out.flatMap(({ id, d }) => [
    { id, d },
    { id: `${id}@x0.25`, d: sized(d, 0.25) },
    { id: `${id}@x3`, d: sized(d, 3) },
  ]);
}

function projects(): { id: string; p: Project }[] {
  const out: { id: string; p: Project }[] = [];
  for (const s of sampleProjects) {
    const p = s.create();
    out.push({ id: `sample:${s.id}`, p });
    // Every piece at the same spot: overlaps and placement problems.
    const piled = structuredClone(p);
    for (const it of piled.items) it.position = { x: 0, y: 0, z: 0 };
    out.push({ id: `sample:${s.id}@piled`, p: piled });
    // A small room with a door, a window and an obstacle: pieces outside it, openings blocked.
    const small = structuredClone(p);
    const f = (
      kind: RoomFeature['kind'],
      wall: number | null,
      extra: Partial<RoomFeature>,
    ): RoomFeature => ({
      id: `f-${kind}`,
      kind,
      wall,
      from: 100,
      width: 800,
      sill: 0,
      height: 2000,
      depth: 300,
      label: kind,
      ...extra,
    });
    small.room = {
      height: 1000,
      outline: [
        [0, 0],
        [1200, 0],
        [1200, 800],
        [0, 800],
      ],
      features: [
        f('door', 0, {}),
        f('window', 0, { from: 600, sill: 400, height: 500 }),
        f('obstacle', null, { x: 100, z: 100, width: 300, height: 300 }),
        f('pipe', 3, { from: 50, sill: 50, width: 100, height: 100, depth: 50 }),
        f('outlet', 1, { from: 50, sill: 200, width: 100, height: 100, depth: 30 }),
      ],
    };
    out.push({ id: `sample:${s.id}@small-room`, p: small });
  }
  return out;
}

type Row = [source: string, severity: string, code: string, en: string, ru: string];

const pick = (ds: Diagnostic[]) => ds.map((x) => [x.severity, x.code, x.message] as const);

function listing(): Row[] {
  const at = (l: Lang) => {
    setLang(l);
    const rows: { source: string; ds: ReturnType<typeof pick> }[] = [];
    for (const { id, d } of designs())
      rows.push({ source: id, ds: pick(buildModel(d).diagnostics) });
    for (const { id, p } of projects())
      rows.push({ source: id, ds: pick(buildProjectModel(p).diagnostics) });
    return rows;
  };
  const en = at('en');
  const ru = at('ru');
  setLang('en');
  const out: Row[] = [];
  en.forEach((r, i) => {
    expect(ru[i].source).toBe(r.source);
    expect(ru[i].ds.length).toBe(r.ds.length);
    r.ds.forEach(([sev, code, msg], j) => {
      expect(ru[i].ds[j][1]).toBe(code);
      out.push([r.source, sev, code, msg, ru[i].ds[j][2]]);
    });
  });
  return out;
}

// The Russian dictionary is a lazy chunk (ADR-229): load it before the Russian rows are built.
beforeAll(() => loadDictionary('ru'));
afterEach(() => setLang('en'));

describe('diagnostic golden (ADR-225)', () => {
  it('every diagnostic of the catalog, the templates and the samples matches the golden (codes split on purpose excepted)', () => {
    const file = new URL('./fixtures/diagnostics-golden.json', import.meta.url);
    const now = listing();
    if (process.env.WRITE_GOLDEN) {
      const unsplit = now.map(([s, sev, c, en, ru]) => [s, sev, SPLIT[c] ?? c, en, ru]);
      writeFileSync(file, `${JSON.stringify(unsplit, null, 0).replace(/\],\[/g, '],\n[')}\n`);
    }
    expect(existsSync(file)).toBe(true);
    const golden = JSON.parse(readFileSync(file, 'utf8')) as Row[];
    expect(now.map(([s, sev, c, en, ru]) => [s, sev, SPLIT[c] ?? c, en, ru])).toEqual(golden);
    expect(golden.length).toBeGreaterThan(100);
  });

  it('opening clearances of every catalog variant and template match the golden (clearance.ts, G-492)', () => {
    const file = new URL('./fixtures/clearance-golden.json', import.meta.url);
    const now = designs().flatMap(({ id, d }) =>
      localClearances(buildModel(d)).map((c) => [id, c.label, c.need, c.box] as const),
    );
    if (process.env.WRITE_GOLDEN)
      writeFileSync(file, `${JSON.stringify(now).replace(/\],\[/g, '],\n[')}\n`);
    expect(existsSync(file)).toBe(true);
    expect(now).toEqual(JSON.parse(readFileSync(file, 'utf8')));
    expect(now.length).toBeGreaterThan(100);
  });
});

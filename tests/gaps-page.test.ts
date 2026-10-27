import 'fake-indexeddb/auto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import {
  decisionsText,
  filterGaps,
  gapCounts,
  parseGaps,
  statusKind,
  validateGapMark,
  type GapMark,
} from '../src/core/gaps';
import { db, listGapMarks, saveGapMark } from '../src/persist/db';

const LEDGER = readFileSync(new URL('../docs/adr/GAPS.md', import.meta.url), 'utf8');

const mark = (gapId: string, decision: GapMark['decision'], note = ''): GapMark => ({
  gapId,
  decision,
  note,
  updatedAt: '2026-10-26T00:00:00.000Z',
});

const SAMPLE = `# Gaps

### G-001: First

- Status: Open
- Origin: ADR-001
- Missing: a
- Request: b
- Questions: c
- Suggested pick: d
- Note: one
- Note: two

### G-002: Second

- Status: Acknowledged (2026-10-25)
- Origin: x
- Missing: x
- Request: x
- Questions: x
- Suggested pick: x

### G-003: Third

- Status: ADR-101
- Origin: x
- Missing: drawer
- Request: x
- Questions: x
- Suggested pick: x

### G-004: Fourth

- Status: Done (abc123)
- Origin: x
- Missing: x
- Request: x
- Questions: x
- Suggested pick: x

### G-005: Broken

- Status: Maybe
`;

describe('gaps ledger parser (ADR-101)', () => {
  it('reads ids, titles, statuses, every field and repeated notes; skips an unknown status', () => {
    const gaps = parseGaps(SAMPLE);
    expect(gaps.map((g) => g.id)).toEqual(['G-001', 'G-002', 'G-003', 'G-004']);
    expect(gaps[0]).toMatchObject({
      title: 'First',
      kind: 'open',
      origin: 'ADR-001',
      missing: 'a',
      request: 'b',
      questions: 'c',
      pick: 'd',
      notes: ['one', 'two'],
    });
    expect(gaps.map((g) => g.kind)).toEqual(['open', 'acknowledged', 'adr', 'done']);
    expect(statusKind('Maybe')).toBeNull();
    expect(parseGaps('')).toEqual([]);
  });

  it('reads the real GAPS.md with the same ids and statuses as scripts/gaps.py', () => {
    const py = execFileSync(
      'python3',
      [
        '-I',
        '-c',
        'import json,sys; sys.path.insert(0,"scripts"); import gaps; ' +
          't=open("docs/adr/GAPS.md").read(); ' +
          'print(json.dumps([[g["id"], g["fields"].get("Status","")] for g in gaps.parse(t)]))',
      ],
      { encoding: 'utf8' },
    );
    const want = JSON.parse(py) as [string, string][];
    const got = parseGaps(LEDGER).map((g) => [g.id, g.status]);
    expect(got).toEqual(want);
    expect(got.length).toBeGreaterThan(90);
  });

  it('counts by status, filters by words and status', () => {
    const gaps = parseGaps(SAMPLE);
    expect(gapCounts(gaps)).toEqual({ open: 1, acknowledged: 1, adr: 1, done: 1 });
    expect(filterGaps(gaps, 'drawer', ['open', 'adr']).map((g) => g.id)).toEqual(['G-003']);
    expect(filterGaps(gaps, 'g-001', ['open']).map((g) => g.id)).toEqual(['G-001']);
    expect(filterGaps(gaps, '', ['done']).map((g) => g.id)).toEqual(['G-004']);
  });

  it('decisions text lists only marked gaps that are Open or moved to an ADR', () => {
    const gaps = parseGaps(SAMPLE);
    expect(decisionsText(gaps, {})).toBe('');
    const text = decisionsText(gaps, {
      'G-001': mark('G-001', 'acknowledge', ' fine as is '),
      'G-002': mark('G-002', 'adr'),
      'G-003': mark('G-003', null, 'ask about drawers'),
      'G-004': mark('G-004', 'acknowledge'),
    });
    expect(text.split('\n')).toEqual([
      'Gap decisions from the app (ADR-101):',
      '- acknowledge G-001 (First): fine as is',
      '- note on G-003 (Third): ask about drawers',
    ]);
    expect(decisionsText(gaps, { 'G-001': mark('G-001', null, '  ') })).toBe('');
    expect(decisionsText(gaps, { 'G-001': mark('G-001', null, 'two\n  lines') })).toContain(
      '- note on G-001 (First): two lines',
    );
    expect(decisionsText(gaps, { 'G-001': mark('G-001', 'adr') })).toContain(
      '- make an ADR from G-001 (First)',
    );
  });

  it('validates stored marks', () => {
    expect(validateGapMark(mark('G-001', 'adr'))).toBe(true);
    expect(validateGapMark({ ...mark('G-001', 'adr'), decision: 'later' })).toBe(false);
    expect(validateGapMark({ ...mark('X', null) })).toBe(false);
    expect(validateGapMark(null)).toBe(false);
  });
});

describe('gap marks on the device (ADR-101, Dexie v9)', () => {
  it('saves and lists marks; an unreadable row is skipped and kept', async () => {
    await saveGapMark(mark('G-010', 'acknowledge', 'ok'));
    await db.gapMarks.put({ gapId: 'G-011', decision: 'nope' } as never);
    const list = await listGapMarks();
    expect(list.map((m) => m.gapId)).toEqual(['G-010']);
    expect(await db.gapMarks.get('G-011')).toBeDefined();
  });

  it('a v8 database upgrades to v9 keeping its rows', async () => {
    const name = 'gaps-upgrade-test';
    const old = new Dexie(name);
    old.version(8).stores({
      designs: 'id, updatedAt, name',
      projects: 'id, updatedAt, name',
      templates: 'id, updatedAt',
      researchDocs: 'key, docId',
      researchMarks: 'id, updatedAt',
      images: 'id',
      decors: 'id',
      projectTemplates: 'id, updatedAt, name',
      prices: 'id',
      models: 'id, createdAt',
    });
    await old.open();
    await old.table('decors').put({ id: 'x' });
    await old.table('models').put({ id: 'm', createdAt: '2026' });
    old.close();
    const Fresh = db.constructor as new (n: string) => typeof db;
    const nw = new Fresh(name);
    await nw.open();
    expect(nw.verno).toBe(10);
    expect(await nw.decors.get('x')).toBeDefined();
    expect(await nw.models.get('m')).toBeDefined();
    expect(await nw.gapMarks.count()).toBe(0);
    nw.close();
  });
});

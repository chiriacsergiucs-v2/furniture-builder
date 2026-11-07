// ADR-212 (G-100): gap marks in a file. Export writes `{ kind: 'furniture-builder-gap-marks', version: 1, exportedAt,
// marks }` with only valid marks; import checks every row with `validateGapMark` (ADR-011), never throws, keeps the
// newer `updatedAt` per gap, and skips and counts invalid rows and rows naming a gap not in the ledger. Same
// `gapMarks` table (`saveGapMarks`), no Dexie version.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  GAP_MARKS_KIND,
  gapMarksFile,
  readGapMarksFile,
  validateGapMark,
  type GapMark,
} from '../src/core/gaps';
import { db, listGapMarks, saveGapMark, saveGapMarks } from '../src/persist/db';

const mark = (
  gapId: string,
  updatedAt: string,
  decision: GapMark['decision'] = 'acknowledge',
  note = '',
): GapMark => ({ gapId, decision, note, updatedAt });

const KNOWN = new Set(['G-001', 'G-002', 'G-003']);
const T1 = '2026-11-01T00:00:00.000Z';
const T2 = '2026-11-02T00:00:00.000Z';
const T3 = '2026-11-03T00:00:00.000Z';

describe('gap marks file (ADR-212, G-100)', () => {
  it('export has the kind, version 1, the date and only valid marks, with only the mark fields', () => {
    const marks = [
      { ...mark('G-001', T1, 'adr', 'make it'), extra: 'dropped' } as GapMark,
      { gapId: 'G-002', decision: 'nope' } as unknown as GapMark,
    ];
    const f = gapMarksFile(marks, T3);
    expect(f).toEqual({
      kind: 'furniture-builder-gap-marks',
      version: 1,
      exportedAt: T3,
      marks: [mark('G-001', T1, 'adr', 'make it')],
    });
    expect(f.kind).toBe(GAP_MARKS_KIND);
  });

  it('round-trips: what Export writes, Import reads back on another device', () => {
    const marks = [mark('G-001', T1, 'acknowledge', 'fine'), mark('G-002', T2, null, 'a note')];
    const text = JSON.stringify(gapMarksFile(marks, T3), null, 2);
    const r = readGapMarksFile(text, KNOWN, {});
    expect(r.problem).toBeUndefined();
    expect(r.apply).toEqual(marks);
    expect(r.imported).toBe(2);
    expect(r.skipped).toBe(0);
    for (const m of r.apply) expect(validateGapMark(m)).toBe(true);
  });

  it('per gap the newer updatedAt wins, against the device and within the file', () => {
    const current = {
      'G-001': mark('G-001', T2, 'acknowledge', 'device newer'),
      'G-002': mark('G-002', T1, 'acknowledge', 'device older'),
    };
    const text = JSON.stringify(
      gapMarksFile(
        [
          mark('G-001', T1, 'adr', 'file older'),
          mark('G-002', T2, 'adr', 'file newer'),
          mark('G-003', T1, null, 'first'),
          mark('G-003', T3, 'adr', 'second, newer'),
          mark('G-003', T2, null, 'third, older'),
        ],
        T3,
      ),
    );
    const r = readGapMarksFile(text, KNOWN, current);
    const byId = Object.fromEntries(r.apply.map((m) => [m.gapId, m]));
    expect(byId['G-001']).toBeUndefined(); // the device's mark is newer: kept
    expect(byId['G-002'].note).toBe('file newer');
    expect(byId['G-003'].note).toBe('second, newer');
    // Valid rows for known gaps count as imported even when the device's mark is newer.
    expect(r.imported).toBe(5);
    expect(r.skipped).toBe(0);
  });

  it('invalid rows and rows naming a gap not in the ledger are skipped and counted', () => {
    const text = JSON.stringify({
      kind: GAP_MARKS_KIND,
      version: 1,
      exportedAt: T3,
      marks: [
        mark('G-001', T1),
        mark('G-999', T1), // not in the ledger
        { gapId: 'G-002', decision: 'maybe', note: '', updatedAt: T1 }, // bad decision
        { gapId: 'G-2', decision: null, note: '', updatedAt: T1 }, // bad id
        { gapId: 'G-003', decision: null, updatedAt: T1 }, // no note
        null,
        'G-003',
      ],
    });
    const r = readGapMarksFile(text, KNOWN, {});
    expect(r.problem).toBeUndefined();
    expect(r.apply.map((m) => m.gapId)).toEqual(['G-001']);
    expect(r.imported).toBe(1);
    expect(r.skipped).toBe(6);
  });

  it('never throws: not JSON, another kind, no marks list or another version apply nothing', () => {
    const bad = [
      '',
      'not json',
      'null',
      '[]',
      JSON.stringify({ kind: 'furniture-builder-project', version: 1, marks: [] }),
      JSON.stringify({ kind: GAP_MARKS_KIND, version: 1, marks: {} }),
    ];
    for (const text of bad) {
      const r = readGapMarksFile(text, KNOWN, {});
      expect(r.apply).toEqual([]);
      expect(r.problem).toBe('The file is not a gap-marks file.');
    }
    const v2 = readGapMarksFile(
      JSON.stringify({ kind: GAP_MARKS_KIND, version: 2, marks: [mark('G-001', T1)] }),
      KNOWN,
      {},
    );
    expect(v2.apply).toEqual([]);
    expect(v2.problem).toBe('The file is from another version of the app.');
  });

  it('saveGapMarks writes the merged marks to the same gapMarks table; older device rows are replaced', async () => {
    expect(db.verno).toBe(12);
    await saveGapMark(mark('G-001', T1, 'acknowledge', 'old'));
    await saveGapMark(mark('G-002', T3, 'acknowledge', 'device newest'));
    const current = Object.fromEntries((await listGapMarks()).map((m) => [m.gapId, m]));
    const text = JSON.stringify(
      gapMarksFile(
        [mark('G-001', T2, 'adr', 'imported'), mark('G-002', T1, null, 'older'), mark('G-003', T1)],
        T3,
      ),
    );
    const r = readGapMarksFile(text, KNOWN, current);
    await saveGapMarks(r.apply);
    const after = Object.fromEntries((await listGapMarks()).map((m) => [m.gapId, m]));
    expect(after['G-001'].note).toBe('imported');
    expect(after['G-002'].note).toBe('device newest');
    expect(after['G-003']).toEqual(mark('G-003', T1));
  });
});

// The sync rule (user 2026-11-05, CLAUDE.md): every feature line carries the date a sync verified it, and
// `pnpm sync:pending` (scripts/sync-pending.mjs) lists nothing a sync still has to check.
import { describe, expect, it } from 'vitest';
import { FEATURES } from '../src/core/features';
import {
  EXEMPT,
  featureLines,
  implementedDates,
  openGaps,
  pending,
} from '../scripts/sync-pending.mjs';

describe('sync:pending (feature tree, ADR-158)', () => {
  const implemented = implementedDates();

  it('gives every feature line a valid checked date', () => {
    const bad = featureLines(FEATURES)
      .filter(({ feature: f }) => {
        const d = f.checked ?? '';
        return !/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d));
      })
      .map(({ path, feature }) => `${path} › ${feature.name}`);
    expect(bad).toEqual([]);
  });

  it('lists nothing pending', () => {
    expect(pending(FEATURES, implemented)).toEqual({
      unchecked: [],
      stale: [],
      unknown: [],
      uncited: [],
    });
  });

  it('exempts only implemented ADRs', () => {
    expect(EXEMPT.filter((a) => !implemented[a])).toEqual([]);
  });

  it('lists an unchecked line, a line checked before its ADR shipped, an unknown id and an uncited ADR', () => {
    const domains = [
      {
        name: 'D',
        features: [
          { name: 'a', adrs: ['ADR-001'] },
          { name: 'b', adrs: ['ADR-002'], checked: '2026-10-21' },
          { name: 'c', adrs: ['N154'], checked: '2026-11-05' },
        ],
      },
    ] as unknown as typeof FEATURES;
    const p = pending(
      domains,
      { 'ADR-001': '2026-10-21', 'ADR-002': '2026-10-21', 'ADR-003': '2026-10-21' },
      [],
    );
    expect(p.unchecked).toEqual(['D › a']);
    expect(p.stale).toEqual([]);
    expect(pending(domains, { 'ADR-002': '2026-10-22' }, []).stale).toEqual([
      'D › b: checked 2026-10-21, ADR-002 2026-10-22',
    ]);
    expect(p.unknown).toEqual(['D › c: N154 is not an implemented or pending ADR']);
    // An ADR still pending in docs/adr (shipped with its pull request) is not unknown.
    expect(pending(domains, {}, [], new Set(['ADR-001', 'ADR-002', 'N154'])).unknown).toEqual([]);
    expect(p.uncited).toEqual(['ADR-003']);
    expect(openGaps('### G-001: x\n\n- Status: Open\n\n### G-002: y\n\n- Status: ADR-175\n')).toBe(
      1,
    );
  });
});

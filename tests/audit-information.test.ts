// ADR-266 (UI audit, Information): the research save banner clears only once the mark that failed is saved, and a
// failure for another mark keeps it; gap-mark import counts applied and kept marks apart.
import { describe, expect, it, vi } from 'vitest';
import { GAP_MARKS_KIND, readGapMarksFile } from '../src/core/gaps';

const fail = vi.hoisted(() => ({ ids: new Set<string>() }));
vi.mock('../src/persist/db', () => ({
  listResearchBundles: async () => [],
  listResearchMarks: async () => [],
  saveResearchBundle: async () => undefined,
  saveResearchMarks: async (marks: { id: string }[]) => {
    if (marks.some((m) => fail.ids.has(m.id))) throw new Error('QuotaExceededError');
  },
}));

describe('research save banner (ADR-266)', () => {
  it('stays for a failure, goes when the failed mark is saved again', async () => {
    const { useResearch } = await import('../src/store/researchStore');
    await useResearch.getState().init();
    fail.ids = new Set(['x1']);
    await useResearch.getState().setMarks(['x1'], { notes: 'a' } as never);
    expect(useResearch.getState().error).toBeTruthy();
    fail.ids = new Set();
    await useResearch.getState().setMarks(['x2'], { notes: 'b' } as never);
    // x1 is written again with x2's save, so the banner goes.
    expect(useResearch.getState().error).toBeNull();
    // A failure for another decision keeps it, even after an unrelated save works.
    fail.ids = new Set(['x3']);
    await useResearch.getState().setMarks(['x3'], { notes: 'c' } as never);
    fail.ids = new Set(['x3']);
    await useResearch.getState().setMarks(['x4'], { notes: 'd' } as never);
    expect(useResearch.getState().error).toBeTruthy();
  });
});

describe('gap-mark import counts (ADR-266)', () => {
  it('a mark older than the device’s is counted as kept, not imported', () => {
    const file = JSON.stringify({
      kind: GAP_MARKS_KIND,
      version: 1,
      marks: [
        {
          gapId: 'G-001',
          decision: 'acknowledge',
          note: '',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    const current = {
      'G-001': {
        gapId: 'G-001',
        decision: 'adr',
        note: '',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    } as never;
    const r = readGapMarksFile(file, new Set(['G-001']), current);
    expect(r.apply).toHaveLength(0);
    expect(r.kept).toBe(1);
  });
});

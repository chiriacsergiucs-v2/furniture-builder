import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import { useDesign } from '../src/store/designStore';

describe('results tabs collapsed until tapped (ADR-091)', () => {
  it('starts collapsed; a tap opens, another switches, the same tab closes', () => {
    const s = () => useDesign.getState();
    expect(s().resultsOpen).toBe(false);
    s().toggleTab('parts');
    expect([s().resultsOpen, s().tab]).toEqual([true, 'parts']);
    s().toggleTab('sheets');
    expect([s().resultsOpen, s().tab]).toEqual([true, 'sheets']);
    s().toggleTab('sheets');
    expect(s().resultsOpen).toBe(false);
    // The Settings cut-list link asks to see the results: it opens the panel.
    s().setTab('checks');
    expect([s().resultsOpen, s().tab]).toEqual([true, 'checks']);
    s().toggleTab('checks');
    expect(s().resultsOpen).toBe(false);
  });

  it('a design with an error leaves the panel collapsed', () => {
    const s = () => useDesign.getState();
    s().load(templates.find((t) => t.id === 'sideboard')!.create());
    s().updateCabinet({ width: 5 });
    expect(s().model.diagnostics.some((d) => d.severity === 'error')).toBe(true);
    expect(s().resultsOpen).toBe(false);
  });
});

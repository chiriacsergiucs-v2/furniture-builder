import { describe, expect, it } from 'vitest';
import { MODE_LABEL, MODES, parseMode } from '../src/ui/shell/uiStore';

describe('editor modes (ADR-079)', () => {
  it('has the three modes in order, with the agreed labels', () => {
    expect(MODES.map((m) => MODE_LABEL[m])).toEqual(['Compose', 'Configure', 'Build & Preview']);
  });
  it('reads a stored mode and falls back to Compose for anything else', () => {
    expect(parseMode('build')).toBe('build');
    expect(parseMode('configure')).toBe('configure');
    expect(parseMode(null)).toBe('compose');
    expect(parseMode('preview')).toBe('compose');
  });
});

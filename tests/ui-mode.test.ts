import { describe, expect, it } from 'vitest';
import { MODE_LABEL, MODES, parseMode, useUi } from '../src/ui/shell/uiStore';

describe('editor modes (ADR-079, ADR-080)', () => {
  it('has two modes in order, with the agreed labels; Configure is gone', () => {
    expect(MODES.map((m) => MODE_LABEL[m])).toEqual(['Compose', 'Build & Preview']);
  });
  it('reads a stored mode and falls back to Compose for anything else, the old configure included', () => {
    expect(parseMode('build')).toBe('build');
    expect(parseMode('compose')).toBe('compose');
    expect(parseMode('configure')).toBe('compose');
    expect(parseMode(null)).toBe('compose');
    expect(parseMode('preview')).toBe('compose');
  });
  it('opens and closes Settings without changing the mode', () => {
    const before = useUi.getState().mode;
    expect(useUi.getState().settingsOpen).toBe(false);
    useUi.getState().setSettingsOpen(true);
    expect(useUi.getState().settingsOpen).toBe(true);
    expect(useUi.getState().mode).toBe(before);
    useUi.getState().setSettingsOpen(false);
    expect(useUi.getState().settingsOpen).toBe(false);
  });
});

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FEATURES } from '../src/ui/info/features';
import { useAsk } from '../src/store/confirmStore';
import { useFastenerList } from '../src/store/fastenerStore';
import { usePieceList } from '../src/store/pieceListStore';
import { usePrices } from '../src/store/priceStore';
import { useProblem } from '../src/store/problemStore';
import { useUi } from '../src/store/uiStore';

// ADR-236: the Zustand stores live in src/store, the feature tree beside the Info page, the Mobila sample in tests.
const SRC = new URL('../src', import.meta.url).pathname;
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });

describe('module locations (ADR-236)', () => {
  it('the six stores import from src/store with their state and actions', () => {
    expect(useAsk.getState()).toEqual({ ask: null });
    expect(Object.keys(useFastenerList.getState()).sort()).toEqual(
      ['choices', 'clear', 'error', 'load', 'loaded', 'ready', 'set'].sort(),
    );
    expect(usePieceList.getState()).toMatchObject({ open: false, drag: null });
    expect(typeof usePieceList.getState().setDrag).toBe('function');
    expect(usePrices.getState()).toMatchObject({ prices: [], state: 'idle' });
    expect(typeof usePrices.getState().setPrice).toBe('function');
    expect(useProblem.getState()).toMatchObject({ focus: null, projectId: null, choice: 0 });
    expect(['compose', 'build']).toContain(useUi.getState().mode);
    expect(typeof useUi.getState().setNotice).toBe('function');
  });

  it('the feature tree imports from src/ui/info', () => {
    expect(FEATURES.length).toBeGreaterThan(0);
    expect(FEATURES.every((d) => typeof d.name === 'string')).toBe(true);
  });

  it('no Zustand store is created under src/ui', () => {
    const hits = files(join(SRC, 'ui')).filter((f) =>
      /from\s+['"]zustand['"]/.test(readFileSync(f, 'utf8')),
    );
    expect(hits.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('no sample generator and no wallCount under src', () => {
    expect(files(SRC).filter((f) => relative(SRC, f).includes('samples/'))).toEqual([]);
    expect(files(SRC).filter((f) => /\bwallCount\b/.test(readFileSync(f, 'utf8')))).toEqual([]);
  });

  it('shopping, fasteners and prices do not import each other in a cycle', () => {
    const from = (f: string) =>
      [...readFileSync(join(SRC, 'core', f), 'utf8').matchAll(/from\s+'\.\/([\w-]+)'/g)].map(
        (m) => m[1],
      );
    expect(from('fasteners.ts')).not.toContain('shopping');
    expect(from('prices.ts')).not.toContain('shopping');
  });
});

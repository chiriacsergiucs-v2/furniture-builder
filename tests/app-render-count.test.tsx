// @vitest-environment jsdom
import { act, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { DESKTOP_WIDTH, renderApp } from './find-it/setup';

// G-500 (N430): App.tsx split along its parts and the editor's heavy children memoised. These count how often the
// editor's panel, drawing and results are rendered by their parent when something they do not show changes; their
// own store subscriptions still re-render them (not counted here, the wrappers below sit outside them).
// Measured before the split (2026-11-27): a notice and a rename each rendered all three again from App (1 each).
const counts = vi.hoisted(() => ({ inspector: 0, elevation: 0, output: 0 }));

vi.mock('../src/ui/Inspector', async (orig) => {
  const m = await orig<typeof import('../src/ui/Inspector')>();
  const Real = m.Inspector;
  return {
    ...m,
    Inspector: (p: ComponentProps<typeof Real>) => {
      if (p.mode === 'compose') counts.inspector++;
      return <Real {...p} />;
    },
  };
});
vi.mock('../src/ui/Elevation', async (orig) => {
  const m = await orig<typeof import('../src/ui/Elevation')>();
  const Real = m.Elevation;
  return {
    ...m,
    Elevation: (p: ComponentProps<typeof Real>) => {
      if (!p?.print) counts.elevation++;
      return <Real {...p} />;
    },
  };
});
vi.mock('../src/ui/Output', async (orig) => {
  const m = await orig<typeof import('../src/ui/Output')>();
  const Real = m.Output;
  return {
    ...m,
    Output: () => {
      counts.output++;
      return <Real />;
    },
  };
});

const reset = () => Object.assign(counts, { inspector: 0, elevation: 0, output: 0 });

describe('App render counts (G-500)', () => {
  it('a notice and a rename do not render the editor panel, drawing or results again from above', async () => {
    await renderApp(DESKTOP_WIDTH);
    await screen.findByRole('navigation', { name: 'Places' });
    // Start-up settles (the last piece is looked up and the placeholder marked pristine).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(counts.inspector).toBeGreaterThan(0);
    const { useUi } = await import('../src/store/uiStore');
    const { useDesign } = await import('../src/store/designStore');

    reset();
    act(() => useUi.getState().setNotice({ ok: true, text: 'Hello' }));
    expect(await screen.findByText('Hello')).toBeTruthy();
    expect(counts).toEqual({ inspector: 0, elevation: 0, output: 0 });

    reset();
    act(() => useDesign.getState().rename('Renamed piece'));
    expect(useDesign.getState().design.name).toBe('Renamed piece');
    expect(counts).toEqual({ inspector: 0, elevation: 0, output: 0 });
  });
});

// @vitest-environment jsdom
// Find-it for ADR-253 (Sizing), ADR-254 (Construction) and ADR-256 (Hardware) at 1280 and 390 px: a typed size is
// saved exactly or stays on screen marked invalid until it is fixed or Escape restores the saved value; "." and ","
// are never dropped; runner lengths and a loose panel's name keep invalid text with the reason; Diagonal asks first;
// Two rails makes a doubled top single; the hole-centres list shows the value in use.
import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';
import type { Space } from '../../src/core/types';

async function settings(width: number) {
  const app = await renderApp(width);
  await app.user.click(await screen.findByRole('button', { name: 'New single piece' }));
  await app.user.click(
    within(await screen.findByRole('dialog')).getAllByRole('button', { name: /Sideboard/ })[0],
  );
  await app.user.click(await screen.findByRole('button', { name: 'Settings' }));
  await screen.findByRole('heading', { name: 'Whole cabinet' });
  const { useDesign } = await import('../../src/store/designStore');
  const params = () =>
    (useDesign.getState().design.product as unknown as { params: Record<string, unknown> }).params;
  return { ...app, useDesign, params };
}

describe.each(WIDTHS)('typed sizes at %ipx (find-it, ADR-253, ADR-254, ADR-256)', (width) => {
  it('"2.5" and "10,5" are refused, not read as 25 and 105', async () => {
    const { user, params } = await settings(width);
    const f = screen.getByLabelText('Shelf set back') as HTMLInputElement;
    const before = params().shelfSetback;
    await user.clear(f);
    await user.type(f, '2.5');
    await user.tab();
    expect(f.value).toBe('2.5');
    expect(f.getAttribute('aria-invalid')).toBe('true');
    expect(params().shelfSetback).toBe(before);
    const b = screen.getByLabelText('Plinth height') as HTMLInputElement;
    const pb = params().plinthHeight;
    await user.clear(b);
    await user.type(b, '10,5');
    await user.tab();
    expect(params().plinthHeight).toBe(pb);
  });

  // Escape restoring the saved value is checked on MmField itself (tests/audit-typed-sizes.test.tsx): on a phone the
  // bottom sheet takes Escape first.
  it('an out-of-range size stays with its error after blur', async () => {
    const { user, params } = await settings(width);
    const f = screen.getByLabelText('Plinth height') as HTMLInputElement;
    const before = params().plinthHeight;
    await user.clear(f);
    await user.type(f, '300');
    await user.tab();
    expect(f.value).toBe('300');
    expect(screen.getByText('Whole number from 0 to 250.')).toBeTruthy();
    expect(params().plinthHeight).toBe(before);
  });

  it('Two rails makes a doubled top single in one step', async () => {
    const { user, params } = await settings(width);
    const layers = screen.queryByRole('radiogroup', { name: 'Top layers' });
    if (layers) await user.click(within(layers).getByRole('radio', { name: /Doubled|2/ }));
    await user.click(screen.getByRole('radio', { name: 'Two rails' }));
    expect(params().topKind).toBe('rails');
    expect(params().topLayers ?? 1).toBe(1);
  });

  it('runner lengths keep invalid text with the reason', async () => {
    const { user, params } = await settings(width);
    const input = await screen.findByLabelText('Runner lengths you can buy');
    const before = JSON.stringify(
      (params().drawers as { runnerLengths?: number[] } | undefined)?.runnerLengths,
    );
    await user.clear(input);
    await user.type(input, '300, 3x0');
    await user.tab();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(
      screen.getByText('Whole numbers in mm, separated by commas. Not saved until they are.'),
    ).toBeTruthy();
    expect(
      JSON.stringify((params().drawers as { runnerLengths?: number[] } | undefined)?.runnerLengths),
    ).toBe(before);
  });

  it('Diagonal over drawers asks first; Cancel keeps Blind and the drawers', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    await user.click(
      within(await screen.findByRole('dialog')).getAllByRole('button', { name: /Blind corner/ })[0],
    );
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    await screen.findByRole('heading', { name: 'Corner unit' });
    const { useDesign } = await import('../../src/store/designStore');
    const p = () =>
      (useDesign.getState().design.product as unknown as { params: Record<string, unknown> })
        .params;
    const id = (p().interior as { id: string }).id;
    act(() =>
      useDesign.getState().updateParams('corner', {
        interior: { id, kind: 'drawers', count: 3 },
      } as never),
    );
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Type' })).getByRole('radio', {
        name: 'Diagonal',
      }),
    );
    const ask = await screen.findByText(/^A diagonal corner holds shelves only\./);
    await user.click(within(ask.closest('dialog')!).getByRole('button', { name: 'Cancel' }));
    expect(p().variant).toBe('blind');
    expect((p().interior as { kind: string }).kind).toBe('drawers');
  });

  it('the hole-centres list offers the value the model uses', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    await user.click(
      within(await screen.findByRole('dialog')).getAllByRole('button', { name: /Sideboard/ })[0],
    );
    const { useDesign } = await import('../../src/store/designStore');
    const d = structuredClone(useDesign.getState().design);
    let spaceId = '';
    const find = (s: Space): Space | undefined =>
      s.front || s.kind === 'drawers'
        ? s
        : s.kind === 'split'
          ? s.children.map(find).find(Boolean)
          : undefined;
    const sp = find((d.product as { params: { interior: Space } }).params.interior)!;
    (sp as { handle?: unknown }).handle = { kind: 'bar', holeSpacing: 150 };
    spaceId = sp.id;
    act(() => useDesign.getState().load(d));
    await user.click(screen.getByRole('radio', { name: 'Compose' }));
    act(() => useDesign.getState().select(spaceId));
    const sel = (
      await screen.findAllByRole('combobox', {
        name: 'Hole centres',
      })
    )[0] as HTMLSelectElement;
    await waitFor(() => expect(sel.value).toBe('150'));
  });
});

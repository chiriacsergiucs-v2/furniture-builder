// @vitest-environment jsdom
// Find-it for owned parts (ADR-267), in jsdom (ADR-108): Parts › I own this… › How many … do you own? › the row leaves
// the cut list, Already owned lists it, and Not owned brings it back.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('owned parts at %ipx (find-it, ADR-267)', (width) => {
  it('Parts → I own this… → how many → Already owned → Not owned', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const picker = await screen.findByRole('dialog');
    await user.click(within(picker).getAllByRole('button', { name: /Chest of drawers/ })[0]);
    await user.click(await screen.findByRole('tab', { name: /^Parts/ }));
    const panel = await screen.findByRole('tabpanel');
    const total = () =>
      /^(\d+) parts in/.exec(within(panel).getByText(/parts in/).textContent!)![1];
    const before = Number(total());

    // A row of several identical parts asks how many; one part would be marked at once.
    await user.click(within(panel).getAllByRole('button', { name: 'I own this…' })[0]);
    const ask = await screen.findByRole('dialog');
    expect(within(ask).getByText(/How many of these \d+ parts do you own\?/)).toBeTruthy();
    const box = within(ask).getByRole('textbox') as HTMLInputElement;
    await user.clear(box);
    await user.type(box, '1');
    await user.click(within(ask).getByRole('button', { name: 'Mark as owned' }));

    expect(Number(total())).toBe(before - 1);
    expect(within(panel).getByText(/1 owned, not cut\./)).toBeTruthy();
    expect(within(panel).getByRole('region', { name: 'Already owned' })).toBeTruthy();

    await user.click(within(panel).getByRole('button', { name: 'Not owned' }));
    expect(Number(total())).toBe(before);
    expect(within(panel).queryByRole('region', { name: 'Already owned' })).toBeNull();
  });
});

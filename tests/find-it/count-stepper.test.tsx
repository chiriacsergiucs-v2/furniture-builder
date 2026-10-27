// @vitest-environment jsdom
// Find-it for quick counts over the drawing (ADR-084, N79), in jsdom (ADR-108). The browser version, with the card's
// position and the 3D view, stays in `tools/count-stepper/find-it.mjs`.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('quick counts at %ipx (find-it, ADR-108)', (width) => {
  it('bare app → New single piece → Sideboard → Compose → the drawer bank → More drawers', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getAllByRole('button', { name: /Sideboard/ })[0]);
    await user.click(await screen.findByRole('radio', { name: 'Compose' }));

    // The drawing hit-tests taps by screen position, which jsdom has no layout for; its keyboard route (Enter on a
    // space) runs the same tap at the space's centre.
    const tapBank = async () => {
      screen.getByRole('button', { name: /^3 drawers space/ }).focus();
      await user.keyboard('{Enter}');
    };
    await screen.findByRole('button', { name: /^3 drawers space/ });
    await tapBank();
    const card = await screen.findByRole('group', { name: 'Quick counts' });
    expect(within(card).getByRole('status', { name: 'Vertical dividers' })).toHaveProperty(
      'textContent',
      '2',
    );

    await tapBank();
    const bankCard = await screen.findByRole('group', { name: 'Quick counts' });
    for (const t of ['Vertical dividers', 'Horizontal dividers', 'Drawers'])
      expect(within(bankCard).getByRole('status', { name: t })).toBeTruthy();
    expect(within(bankCard).getByRole('status', { name: 'Vertical dividers' }).textContent).toBe(
      '0',
    );

    await user.click(within(bankCard).getByRole('button', { name: 'More drawers' }));
    const after = screen.getByRole('group', { name: 'Quick counts' });
    expect(within(after).getByRole('status', { name: 'Drawers' }).textContent).toBe('4');
    expect(screen.getAllByText('4 drawers', { exact: true }).length).toBeGreaterThan(0);
  });
});

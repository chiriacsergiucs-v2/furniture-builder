// @vitest-environment jsdom
// Find-it for "no doors or handles inside the cabinet" (N109), in jsdom (ADR-108): once the space around one has
// doors, the inner space offers no Front or handle choice.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('doors and handles inside doors at %ipx (find-it, N109)', (width) => {
  it('Sideboard › Compose › whole interior gets a door › an inner space has no Front or handles', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getAllByRole('button', { name: /Sideboard/ })[0]);
    await user.click(await screen.findByRole('radio', { name: 'Compose' }));

    // The drawing hit-tests taps by screen position, which jsdom has no layout for; Enter on a space runs the same
    // tap. Each further tap at the same spot selects one space smaller, so tap until the drawer bank is selected.
    const tapBank = async () => {
      for (let i = 0; i < 4 && !screen.queryByText('Selected: Drawers'); i++) {
        screen.getByRole('button', { name: /^3 drawers space/ }).focus();
        await user.keyboard('{Enter}');
      }
      expect(screen.getByText('Selected: Drawers')).toBeTruthy();
    };
    const crumbs = () => screen.getByRole('navigation', { name: 'Where this space sits' });

    // Before the outer doors, the drawer bank still offers a front.
    await tapBank();
    expect(screen.getByRole('radiogroup', { name: 'Front' })).toBeTruthy();

    // The whole interior: one door over everything.
    await user.click(within(crumbs()).getByRole('button', { name: 'Interior' }));
    const front = await screen.findByRole('radiogroup', { name: 'Front' });
    await user.click(within(front).getByRole('radio', { name: 'Door' }));
    expect(screen.getByRole('radiogroup', { name: 'Handles on the doors' })).toBeTruthy();

    // Back to the drawer bank: no Front, no handles, and the reason.
    await tapBank();
    expect(screen.getByText(/Doors and handles go on the outside only/)).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: 'Front' })).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: /^Handles on/ })).toBeNull();
  });
});

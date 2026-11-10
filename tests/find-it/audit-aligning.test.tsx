// @vitest-environment jsdom
// Find-it for ADR-251 (UI audit, Aligning) at 1280 and 390 px: the plan offers **Move alone** beside Snap (inside
// Options on a phone), and the connected-pieces hint names it.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { projectWithTwoPieces, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('Move alone at %ipx (find-it, ADR-251)', (width) => {
  it('Move alone is a toggle beside Snap, off by default', async () => {
    const { user } = await renderApp(width);
    await projectWithTwoPieces(user);
    const plan = await screen.findByRole('figure', { name: /Room plan, seen from above/ });
    const options = within(plan).queryByRole('button', { name: 'Options' });
    if (options) await user.click(options);
    const toggle = await screen.findByRole('checkbox', { name: 'Move alone' });
    expect((toggle as HTMLInputElement).checked).toBe(false);
    await user.click(toggle);
    expect((toggle as HTMLInputElement).checked).toBe(true);
  });
});

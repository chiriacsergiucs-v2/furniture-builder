// @vitest-environment jsdom
// Find-it: the piece Settings steps rail — "Boards" opens Boards, sheets and saw cut, which leads to the Material
// control with its "Replace parts with their own board too" toggle.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('boards step at %ipx (find-it)', (width) => {
  it('Settings → step Boards → Boards, sheets and saw cut opens → Choose a board for parts… → force toggle', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const picker = await screen.findByRole('dialog');
    await user.click(within(picker).getAllByRole('button', { name: /Chest of drawers/ })[0]);
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog');
    await user.click(within(settings).getByRole('button', { name: /Boards/ }));
    await waitFor(() => {
      const d = within(settings)
        .getByText('Boards, sheets and saw cut', { selector: 'summary' })
        .closest('details');
      expect(d?.open).toBe(true);
    });
    await user.click(within(settings).getByRole('button', { name: 'Choose a board for parts…' }));
    const md = await screen.findByRole('dialog', { name: 'Material' });
    await user.click(within(md).getByRole('radio', { name: 'Item' }));
    expect(within(md).getByLabelText('Replace parts with their own board too')).toBeTruthy();
  });
});

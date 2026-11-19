// @vitest-environment jsdom
// Find-it for the quick board thickness picker (N350), in jsdom (ADR-108): Settings › Boards, sheets and saw cut
// shows "Common thickness (mm)" with 16, 18 and 22 under each board, and a pick sets that board's Thickness.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('common thickness picker at %ipx (find-it, N350)', (width) => {
  it('Settings › Boards, sheets and saw cut › Common thickness (mm) › 22 sets Thickness to 22', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const picker = await screen.findByRole('dialog');
    await user.click(within(picker).getAllByRole('button', { name: /Chest of drawers/ })[0]);
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog');
    await user.click(within(settings).getByText('Boards, sheets and saw cut'));

    const group = within(settings).getAllByRole('radiogroup', { name: 'Common thickness (mm)' })[0];
    for (const mm of ['16', '18', '22'])
      expect(within(group).getByRole('radio', { name: mm })).toBeTruthy();
    await user.click(within(group).getByRole('radio', { name: '22' }));
    expect(within(group).getByRole('radio', { name: '22' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    const thickness = within(settings).getAllByRole('textbox', {
      name: 'Thickness',
    })[0] as HTMLInputElement;
    expect(thickness.value).toBe('22');
  });
});

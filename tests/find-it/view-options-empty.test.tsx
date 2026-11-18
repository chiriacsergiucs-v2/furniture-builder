// @vitest-environment jsdom
// Find-it for audit finding F-25 (N318) in jsdom (ADR-108): on a phone in 2D, a single piece shows no "Options" menu
// beside 2D · 3D · Both, because every tool in it needs the 3D view; the menu is not an empty panel.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PHONE_WIDTH, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('no empty view options at %ipx (find-it, F-25)', (width) => {
  it('a single piece in 2D has no Options menu with nothing in it', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    await user.click(
      within(await screen.findByRole('dialog')).getAllByRole('button', { name: /Sideboard/ })[0],
    );
    expect(await screen.findByRole('radiogroup', { name: 'View' })).toBeTruthy();
    // 2D is the view when WebGL is missing (jsdom) or on a phone: the tools that need 3D are not offered.
    const options = screen.queryAllByText('Options');
    if (width === PHONE_WIDTH) expect(options.length).toBe(0);
  });
});

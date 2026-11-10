// @vitest-environment jsdom
// Find-it for the editing-flow fixes (ADR-243 to ADR-246, N253), in jsdom (ADR-108): More actions → Lock boards and
// Lock construction show in the lock chip; Lock → Remove from project is refused with the reason; More actions →
// Rename… renames the project piece. At 390 and 1280 px.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addPiece, openMenu, openSheet, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('editing flows at %ipx (find-it, ADR-243–246)', (width) => {
  it('boards/construction locks in the chip; a locked piece is not removed; Rename… renames it', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    await user.type(within(create).getByRole('textbox'), `Flows ${width}`);
    await user.click(within(create).getByRole('button', { name: 'Create project' }));
    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    await openSheet(user, panel);
    await addPiece(user);
    const card = await screen.findByRole('region', { name: /^Selected piece: / });

    // ADR-244: Lock boards and Lock construction are named in the chip.
    let menu = await openMenu(user, card);
    await user.click(within(menu).getByRole('button', { name: 'Lock boards' }));
    menu = await openMenu(user, card);
    await user.click(within(menu).getByRole('button', { name: 'Lock construction' }));
    await waitFor(() =>
      expect(within(card).getByText('Locked: boards, construction')).toBeTruthy(),
    );

    // ADR-243: a placement-locked piece is not removed; the reason is shown.
    await user.click(within(card).getByRole('button', { name: 'Lock' }));
    menu = await openMenu(user, card);
    await user.click(within(menu).getByRole('button', { name: /^Remove/ }));
    const ask = await screen.findByRole('dialog');
    await user.click(within(ask).getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText(/is locked — unlock it to remove it/)).toBeTruthy();
    expect(screen.getByRole('region', { name: /^Selected piece: / })).toBeTruthy();

    // ADR-245: More actions → Rename… renames the project piece.
    menu = await openMenu(user, card);
    await user.click(within(menu).getByRole('button', { name: 'Rename…' }));
    const name = await screen.findByRole('dialog');
    const field = within(name).getByRole('textbox');
    await user.clear(field);
    await user.type(field, 'Sink base');
    await user.click(within(name).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('region', { name: 'Selected piece: Sink base' })).toBeTruthy();
  });
});

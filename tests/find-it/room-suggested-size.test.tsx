// @vitest-environment jsdom
// Find-it for ADR-232 (N237), in jsdom (ADR-108), at 1280 and 390 px, from the bare app by role and visible text:
// a new project with a sideboard → Add the room → the room's summary shows the same suggested size as before the
// room auto-size moved from RoomSection into core (`suggestRoomSize`).
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openSheet, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('room suggested size at %ipx (find-it, ADR-232)', (width) => {
  it('Add the room → Rectangle · 3000 × 3000 × 2500 mm, as before', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    await user.click(within(create).getByRole('button', { name: 'Create project' }));
    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    await openSheet(user, panel);
    await user.click(within(panel).getByRole('button', { name: 'Add a piece' }));
    const dlg = await screen.findByRole('dialog', { name: 'Add a piece' });
    await user.type(within(dlg).getByRole('searchbox', { name: 'Search the items' }), 'Sideboard');
    await user.click(within(dlg).getAllByRole('button', { name: /Sideboard/ })[0]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a piece' })).toBeNull());
    const place = screen.queryByRole('button', { name: 'Place to the right' });
    if (place) await user.click(place);
    await openSheet(user, panel);
    await user.click(await screen.findByRole('button', { name: 'Add the room' }));
    await openSheet(user, panel);
    const room = screen.getByRole('region', { name: 'Room' });
    expect(within(room).getByText('Rectangle · 3000 × 3000 × 2500 mm')).toBeTruthy();
  });
});

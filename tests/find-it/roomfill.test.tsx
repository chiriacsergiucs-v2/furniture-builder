// @vitest-environment jsdom
// Find-it for Fill the room (ADR-173, N176), in jsdom (ADR-108): More → New… → Fill the room → Room (rectangle)
// → Walls → Show suggestions → cards → Use this mix → the project opens with its room and pieces; in that project
// the ⋯ menu offers "Fill the room…", which adds a mix to the project. ADR-177 (N180): the mix's piece list shows
// the wall corner (Wall blind corner) above the corner cabinet.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('fill the room at %ipx (find-it, ADR-173)', (width) => {
  it('New… → Fill the room → suggestions → Use this mix → a project with a room; ⋯ → Fill the room… adds a mix', async () => {
    const { user } = await renderApp(width);
    await user.click(screen.getByLabelText('More'));
    await user.click(await screen.findByRole('button', { name: /New…/ }));
    const start = await screen.findByRole('dialog', { name: 'Start something new' });
    await user.click(within(start).getByRole('button', { name: /^Fill the room/ }));
    const dlg = await screen.findByRole('dialog', { name: 'Fill the room' });
    expect(within(dlg).getByRole('heading', { name: 'Room' })).toBeTruthy();
    await user.click(within(dlg).getByRole('button', { name: 'Next' }));
    const walls = within(dlg).getByRole('group', { name: 'Walls to fill' });
    expect(within(walls).getAllByRole('checkbox')).toHaveLength(4);
    // Two walls only: the back wall and the right wall.
    await user.click(within(walls).getByRole('checkbox', { name: /^Wall 3,/ }));
    await user.click(within(walls).getByRole('checkbox', { name: /^Wall 4,/ }));
    await user.click(within(dlg).getByRole('button', { name: 'Show suggestions' }));
    const cards = await within(dlg).findAllByRole('button', { name: 'Use this mix' });
    expect(cards.length).toBeGreaterThan(0);
    expect(within(dlg).getAllByText(/corner cabinet/).length).toBeGreaterThan(0);
    await user.click(cards[0]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Fill the room' })).toBeNull());

    // The project is open with its room and pieces.
    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    const peek = panel.querySelector<HTMLButtonElement>('.sheet-peek');
    if (peek?.getAttribute('aria-expanded') === 'false') await user.click(peek);
    const all = within(panel).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
    if (all) await user.click(all);
    const pieces = within(within(panel).getByRole('list', { name: 'Pieces' }));
    const before = pieces.getAllByRole('button').length;
    expect(before).toBeGreaterThan(2);
    // ADR-177: the corner of the two walls gets a wall corner above its corner cabinet (blind by default).
    expect(pieces.getAllByRole('button', { name: /Wall blind corner/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole('figure', { name: /Room plan, seen from above/ })).toBeTruthy();

    // In the project: ⋯ → Fill the room… → Walls (the project's room) → suggestions → Add this mix.
    await user.click(screen.getByLabelText('More'));
    await user.click(await screen.findByRole('button', { name: /^Fill the room…/ }));
    const again = await screen.findByRole('dialog', { name: 'Fill the room' });
    expect(within(again).getByText(/This project’s room/)).toBeTruthy();
    const walls2 = within(again).getByRole('group', { name: 'Walls to fill' });
    for (const name of [/^Wall 1,/, /^Wall 2,/, /^Wall 4,/])
      await user.click(within(walls2).getByRole('checkbox', { name }));
    await user.click(within(again).getByRole('button', { name: 'Show suggestions' }));
    const add = await within(again).findAllByRole('button', { name: 'Add this mix' });
    await user.click(add[0]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Fill the room' })).toBeNull());
    const all2 = within(panel).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
    if (all2) await user.click(all2);
    await waitFor(() =>
      expect(
        within(within(panel).getByRole('list', { name: 'Pieces' })).getAllByRole('button').length,
      ).toBeGreaterThan(before),
    );
  });
});

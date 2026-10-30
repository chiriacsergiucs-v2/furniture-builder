// @vitest-environment jsdom
// Find-it for the size of a group and grouped pieces moving together (ADR-148, N149), in jsdom (ADR-108): from the bare
// app, two pieces are grouped; the group card shows "Size of the group" with Width, Height, Depth and "Split width";
// a new width is shared Equally; a single piece shows Height beside Width and Depth.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { piecesList, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('group size at %ipx (find-it, ADR-148)', (width) => {
  it('bare app → new project → two pieces → Group → Size of the group → Width Equally', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    await user.type(within(create).getByRole('textbox'), 'Group test');
    await user.click(within(create).getByRole('button', { name: 'Create project' }));

    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    const peek = panel.querySelector<HTMLButtonElement>('.sheet-peek');
    if (peek?.getAttribute('aria-expanded') === 'false') await user.click(peek);
    const addPiece = async () => {
      await user.click(within(panel).getByRole('button', { name: 'Add a piece' }));
      const dlg = await screen.findByRole('dialog');
      await user.type(within(dlg).getByRole('searchbox', { name: 'Search the items' }), 'Base');
      await user.click(
        within(dlg).getAllByRole('button', { name: /Base cabinet, doors: 1 door \+ shelf/ })[0],
      );
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    };
    await addPiece();
    await addPiece();

    // Select both (Select on: a tap adds a piece, ADR-159) and group them. With Select on the list stays (ADR-160).
    const list = await piecesList(user, panel);
    const rows = () => within(list).getAllByRole('button');
    const selectMode = within(panel).getByRole('checkbox', { name: 'Select' });
    await user.click(selectMode);
    await user.click(rows()[0]);
    await user.click(rows()[1]);
    await user.click(await within(panel).findByRole('button', { name: 'Group' }));

    const size = await within(panel).findByRole('group', { name: 'Size of the group' });
    const field = (name: string) => within(size).getByRole('textbox', { name }) as HTMLInputElement;
    for (const f of ['Width', 'Height', 'Depth']) expect(field(f)).toBeTruthy();
    const split = within(size).getByRole('radiogroup', { name: 'Split width' });
    await user.click(within(split).getByRole('radio', { name: 'Equally' }));

    const before = Number(field('Width').value);
    await user.clear(field('Width'));
    await user.type(field('Width'), `${before + 200}{Enter}`);
    await waitFor(() => expect(Number(field('Width').value)).toBe(before + 200));
    // Each piece grew by 100 mm: the list shows the new size.
    const each = (before + 200) / 2;
    await waitFor(() => expect(within(list).getAllByText(new RegExp(`^${each} ×`)).length).toBe(2));

    // A single piece (Select off, second tap) shows Height next to Width and Depth.
    await user.click(selectMode);
    await user.click(rows()[0]);
    const piece = await within(panel).findByRole('group', { name: 'Size of the whole piece' });
    for (const f of ['Width', 'Height', 'Depth'])
      expect(within(piece).getByRole('textbox', { name: f })).toBeTruthy();
  });
});

// @vitest-environment jsdom
// Find-it for a common top or bottom (ADR-165, N167), in jsdom (ADR-108): select two base units standing side by
// side → Common top → the parts list has one Common top; with a wardrobe in the selection the toggle is off and says
// why.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addPiece, composePanel, renderApp, selectRows, WIDTHS } from './setup';

describe.each(WIDTHS)('common top at %ipx (find-it, ADR-165)', (width) => {
  it('two base units → Select both → Common top → Parts lists one Common top; a wardrobe makes it off', async () => {
    const { user } = await renderApp(width);
    await user.click(screen.getByLabelText('More'));
    await user.click(await screen.findByRole('button', { name: /New…/ }));
    const start = await screen.findByRole('dialog', { name: 'Start something new' });
    await user.click(within(start).getByRole('button', { name: /Project with several pieces/ }));
    await user.click(await screen.findByRole('radio', { name: 'Compose' }));
    await addPiece(user, /Base cabinet, doors: 1 door/);
    await addPiece(user, /Base cabinet, doors: 1 door/);

    // Select both: the Select switch, then a tap on each row.
    const side = composePanel();
    await selectRows(user, [0, 1]);
    const card = within(side).getByRole('region', { name: /^2 pieces selected/ });
    const common = within(card).getByRole('group', { name: 'Common top, bottom and sides' });
    const top = within(common).getByRole('checkbox', { name: 'Common top' });
    expect((top as HTMLInputElement).disabled).toBe(false);
    await user.click(top);
    await waitFor(() => expect((top as HTMLInputElement).checked).toBe(true));

    // Parts: one Common top.
    await user.click(screen.getByRole('tab', { name: /^Parts/ }));
    const inTables = screen
      .getAllByRole('table')
      .flatMap((tb) => within(tb).queryAllByText('Common top'));
    expect(inTables).toHaveLength(1);

    // A wardrobe in the selection: Common top is off, disabled, with the reason.
    await user.click(within(side).getByRole('checkbox', { name: 'Select' }));
    await addPiece(user, /Wardrobe/);
    await selectRows(user, [0, 1, 2]);
    const card3 = within(side).getByRole('region', { name: /^3 pieces selected/ });
    const top3 = within(
      within(card3).getByRole('group', { name: 'Common top, bottom and sides' }),
    ).getByRole('checkbox', { name: 'Common top' });
    expect((top3 as HTMLInputElement).checked).toBe(false);
    expect((top3 as HTMLInputElement).disabled).toBe(true);
    expect(
      within(card3).getAllByText(
        /^Wardrobe (has another plinth height|is not the same height|is not the same depth|does not touch)/,
      ).length,
    ).toBeGreaterThan(0);
  });
});

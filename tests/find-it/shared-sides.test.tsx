// @vitest-environment jsdom
// Find-it for shared sides (ADR-190, N195), in jsdom (ADR-108): select two base units standing side by side → Shared
// sides → the parts list counts 3 sides; with a wardrobe in the selection the toggle is off and says why.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addPiece, composePanel, renderApp, selectRows, WIDTHS } from './setup';

describe.each(WIDTHS)('shared sides at %ipx (find-it, ADR-190)', (width) => {
  it('two base units → Select both → Shared sides → Parts counts 3 sides; a wardrobe makes it off', async () => {
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
    const top = within(common).getByRole('checkbox', { name: 'Shared sides' });
    expect((top as HTMLInputElement).disabled).toBe(false);
    await user.click(top);
    await waitFor(() => expect((top as HTMLInputElement).checked).toBe(true));

    // Parts: three sides, not four.
    await user.click(screen.getByRole('tab', { name: /^Parts/ }));
    const sides = screen
      .getAllByRole('row')
      .filter((tr) => /: (Left|Right) side/.test(tr.textContent ?? ''))
      .reduce((n, tr) => n + Number(within(tr).queryAllByRole('cell')[0]?.textContent ?? 0), 0);
    expect(sides).toBe(3);

    // A wardrobe in the selection: Shared sides is off, disabled, with the reason.
    await user.click(within(side).getByRole('checkbox', { name: 'Select' }));
    await addPiece(user, /Wardrobe/);
    await selectRows(user, [0, 1, 2]);
    const card3 = within(side).getByRole('region', { name: /^3 pieces selected/ });
    const top3 = within(
      within(card3).getByRole('group', { name: 'Common top, bottom and sides' }),
    ).getByRole('checkbox', { name: 'Shared sides' });
    expect((top3 as HTMLInputElement).checked).toBe(false);
    expect((top3 as HTMLInputElement).disabled).toBe(true);
    expect(
      within(card3).getAllByText(
        /^Wardrobe (has another plinth height|is not the same height|is not the same depth|does not touch)/,
      ).length,
    ).toBeGreaterThan(0);
  });
});

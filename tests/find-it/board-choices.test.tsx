// @vitest-environment jsdom
// Find-it for board choices (ADR-164, N166), in jsdom (ADR-108): the New-piece wizard's Board offers the project's
// boards and the user's decor list, starts on the project's carcass board, and puts it on every part.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

const CSV =
  'manufacturer;type;code;name;thickness;color\nEgger;PAL;H1145;Bardolino oak;18;#a07850\n';

describe.each(WIDTHS)('board choices at %ipx (find-it, ADR-164)', (width) => {
  it('decor list → project on PAL 18 oak → New piece, step by step → Board → Add to project', async () => {
    const { user } = await renderApp(width);
    // A single piece: Settings › Boards, sheets and saw cut › Import decor list (CSV).
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const picker = await screen.findByRole('dialog');
    await user.click(within(picker).getAllByRole('button', { name: /Chest of drawers/ })[0]);
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog');
    await user.click(within(settings).getByText('Boards, sheets and saw cut'));
    await user.upload(
      within(settings).getByLabelText('Import decor list (CSV)'),
      new File([CSV], 'mine.csv', { type: 'text/csv' }),
    );
    expect(await within(settings).findByText(/1 decor imported from mine\.csv/)).toBeTruthy();
    await user.click(within(settings).getByRole('button', { name: 'Done' }));

    // ⋯ › New… › Project with several pieces, with one base cabinet; Material › Whole project › Carcass › PAL 18 oak.
    await user.click(screen.getByLabelText('More'));
    await user.click(await screen.findByRole('button', { name: /New…/ }));
    const start = await screen.findByRole('dialog', { name: 'Start something new' });
    await user.click(within(start).getByRole('button', { name: /Project with several pieces/ }));
    await user.click(await screen.findByRole('radio', { name: 'Compose' }));
    await user.click(await screen.findByRole('button', { name: 'Add a piece' }));
    let list = await screen.findByRole('dialog', { name: 'Add a piece' });
    await user.click(within(list).getAllByRole('button', { name: /Base cabinet/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Material' }));
    const md = await screen.findByRole('dialog', { name: 'Material' });
    await user.click(within(md).getByRole('radio', { name: 'Whole project' }));
    await user.click(within(md).getByRole('button', { name: 'Carcass' }));
    await user.selectOptions(
      within(md).getByRole('combobox', { name: 'Board' }),
      'PAL 18 oak, 18 mm',
    );
    await user.click(within(md).getByRole('button', { name: 'Apply material' }));
    expect(within(md).getByRole('status').textContent).toMatch(/Applied to 1 item/);
    await user.click(within(md).getByRole('button', { name: 'Close' }));

    // Add a piece › New piece, step by step: Board starts on PAL 18 oak and lists the decor.
    const side = screen.getByRole('complementary', { name: 'Compose' });
    const all = within(side).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
    if (all) await user.click(all);
    await user.click(within(side).getByRole('button', { name: 'Add a piece' }));
    list = await screen.findByRole('dialog', { name: 'Add a piece' });
    await user.click(within(list).getByRole('button', { name: /New piece, step by step/ }));
    const wiz = await screen.findByRole('dialog', { name: 'New piece' });
    await user.click(within(wiz).getByRole('button', { name: 'Skip' }));
    const board = await within(wiz).findByRole('combobox', { name: 'Board' });
    expect((board as HTMLSelectElement).selectedOptions[0].textContent).toBe('PAL 18 oak, 18 mm');
    expect(
      within(board).getByRole('option', { name: 'Egger H1145 Bardolino oak, 18 mm (your list)' }),
    ).toBeTruthy();
    for (let i = 0; i < 20 && !within(wiz).queryByRole('button', { name: 'Add to project' }); i++)
      await user.click(within(wiz).getByRole('button', { name: 'Next' }));
    await user.click(within(wiz).getByRole('button', { name: 'Add to project' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New piece' })).toBeNull());

    // The parts list: the new piece's doors and back are on PAL 18 oak too.
    await user.click(screen.getByRole('tab', { name: /^Parts/ }));
    const oak = screen
      .getAllByRole('table')
      .find((t) => t.querySelector('caption')?.textContent?.includes('PAL 18 oak'))!;
    expect(within(oak).getAllByText(/Cabinet: (Door|Back)/).length).toBeGreaterThan(0);
    expect(within(oak).getAllByText(/Cabinet: Back/).length).toBeGreaterThan(0);
  });
});

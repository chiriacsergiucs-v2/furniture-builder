// @vitest-environment jsdom
// Find-it for a common top or bottom (ADR-165, N167), in jsdom (ADR-108): select two base units standing side by
// side → Common top → the parts list has one Common top; with a wardrobe in the selection the toggle is off and says
// why.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

type User = Awaited<ReturnType<typeof renderApp>>['user'];

async function addPiece(user: User, name: RegExp) {
  const side = screen.getByRole('complementary', { name: 'Compose' });
  const all = within(side).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
  if (all) await user.click(all);
  await user.click(within(side).getByRole('button', { name: 'Add a piece' }));
  const list = await screen.findByRole('dialog', { name: 'Add a piece' });
  await user.click(within(list).getAllByRole('button', { name })[0]);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a piece' })).toBeNull());
  const place = screen.queryByRole('button', { name: 'Place to the right' });
  if (place) await user.click(place);
}

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
    const side = screen.getByRole('complementary', { name: 'Compose' });
    const all = within(side).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
    if (all) await user.click(all);
    await user.click(within(side).getByRole('checkbox', { name: 'Select' }));
    const rows = within(within(side).getByRole('list', { name: 'Pieces' })).getAllByRole('button');
    for (const r of rows) if (r.getAttribute('aria-pressed') !== 'true') await user.click(r);
    const card = within(side).getByRole('region', { name: /^2 pieces selected/ });
    const common = within(card).getByRole('group', { name: 'Common top and bottom' });
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
    const all2 = within(side).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
    if (all2) await user.click(all2);
    await user.click(within(side).getByRole('checkbox', { name: 'Select' }));
    const rows3 = within(within(side).getByRole('list', { name: 'Pieces' })).getAllByRole('button');
    for (const r of rows3) if (r.getAttribute('aria-pressed') !== 'true') await user.click(r);
    const card3 = within(side).getByRole('region', { name: /^3 pieces selected/ });
    const top3 = within(
      within(card3).getByRole('group', { name: 'Common top and bottom' }),
    ).getByRole('checkbox', { name: 'Common top' });
    expect((top3 as HTMLInputElement).checked).toBe(false);
    expect((top3 as HTMLInputElement).disabled).toBe(true);
    expect(
      within(card3).getAllByText(/not the same height|not the same depth|do not touch|turned/)
        .length,
    ).toBeGreaterThan(0);
  });
});

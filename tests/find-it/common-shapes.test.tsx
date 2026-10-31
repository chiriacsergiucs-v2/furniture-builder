// @vitest-environment jsdom
// Find-it for a common top over a corner unit (ADR-169, N171), in jsdom (ADR-108): an L-shaped corner base and two
// base units beside it → Select all → Common top → the parts list has one Common top, cut to template.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

type User = Awaited<ReturnType<typeof renderApp>>['user'];

async function addPiece(user: User, search: string, name: RegExp) {
  const side = screen.getByRole('complementary', { name: 'Compose' });
  const all = within(side).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
  if (all) await user.click(all);
  await user.click(within(side).getByRole('button', { name: 'Add a piece' }));
  const list = await screen.findByRole('dialog', { name: 'Add a piece' });
  await user.type(within(list).getByRole('searchbox', { name: 'Search the items' }), search);
  await user.click(within(list).getAllByRole('button', { name })[0]);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a piece' })).toBeNull());
  const place = screen.queryByRole('button', { name: 'Place to the right' });
  if (place) await user.click(place);
}

describe.each(WIDTHS)('common top over a corner at %ipx (find-it, ADR-169)', (width) => {
  it('L corner + two base units → Select all → Common top → Parts: Common top, cut to template', async () => {
    const { user } = await renderApp(width);
    await user.click(screen.getByLabelText('More'));
    await user.click(await screen.findByRole('button', { name: /New…/ }));
    const start = await screen.findByRole('dialog', { name: 'Start something new' });
    await user.click(within(start).getByRole('button', { name: /Project with several pieces/ }));
    await user.click(await screen.findByRole('radio', { name: 'Compose' }));
    await addPiece(user, 'Base L', /L corner: Base L/);
    await addPiece(user, 'Base cabinet', /Base cabinet, doors: 1 door/);
    await addPiece(user, 'Base cabinet', /Base cabinet, doors: 1 door/);

    const side = screen.getByRole('complementary', { name: 'Compose' });
    const all = within(side).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
    if (all) await user.click(all);
    await user.click(within(side).getByRole('checkbox', { name: 'Select' }));
    const rows = within(within(side).getByRole('list', { name: 'Pieces' })).getAllByRole('button');
    for (const r of rows) if (r.getAttribute('aria-pressed') !== 'true') await user.click(r);
    const card = within(side).getByRole('region', { name: /^3 pieces selected/ });
    const top = within(
      within(card).getByRole('group', { name: 'Common top and bottom' }),
    ).getByRole('checkbox', { name: 'Common top' });
    expect((top as HTMLInputElement).disabled).toBe(false);
    await user.click(top);
    await waitFor(() => expect((top as HTMLInputElement).checked).toBe(true));

    await user.click(screen.getByRole('tab', { name: /^Parts/ }));
    const row = screen
      .getAllByRole('row')
      .filter((tr) => within(tr).queryByText('Common top', { exact: false }));
    expect(row).toHaveLength(1);
    expect(row[0].textContent).toMatch(/cut to template/);
  });
});

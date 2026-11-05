// @vitest-environment jsdom
// Find-it for repairs that carry a piece's whole group (ADR-176, N179), in jsdom (ADR-108): from the bare app, three
// base units side by side; the first and the third are grouped and the first is locked; the middle one is pushed
// 34 mm into the third. Checks → the overlap → the problem banner lists "Move … (piece 3) 34 mm to the right" disabled
// with "Refused: … is locked — unlock it to move it."; it cannot be chosen, and the repair that applies stays chosen.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { piecesList, renderApp, WIDTHS } from './setup';

type User = Awaited<ReturnType<typeof renderApp>>['user'];

async function addPiece(user: User, panel: HTMLElement) {
  const all = within(panel).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
  if (all) await user.click(all);
  await user.click(within(panel).getByRole('button', { name: 'Add a piece' }));
  const dlg = await screen.findByRole('dialog', { name: 'Add a piece' });
  await user.click(within(dlg).getAllByRole('button', { name: /Base cabinet, doors: 1 door/ })[0]);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a piece' })).toBeNull());
  const place = screen.queryByRole('button', { name: 'Place to the right' });
  if (place) await user.click(place);
}

describe.each(WIDTHS)('repairs carry the group at %ipx (find-it, ADR-176)', (width) => {
  it('Checks → overlap → a repair the group cannot follow shows "Refused:" with its reason, disabled', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    await user.type(within(create).getByRole('textbox'), `Group repairs ${width}`);
    await user.click(within(create).getByRole('button', { name: 'Create project' }));
    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    const peek = panel.querySelector<HTMLButtonElement>('.sheet-peek');
    if (peek?.getAttribute('aria-expanded') === 'false') await user.click(peek);
    await addPiece(user, panel);
    await addPiece(user, panel);
    await addPiece(user, panel);

    // Group the first and the third (Select on: a tap adds a piece, ADR-159).
    let list = await piecesList(user, panel);
    const rows = () => within(list).getAllByRole('button');
    const selectMode = within(panel).getByRole('checkbox', { name: 'Select' });
    await user.click(selectMode);
    await user.click(rows()[0]);
    await user.click(rows()[2]);
    await user.click(await within(panel).findByRole('button', { name: 'Group' }));
    await user.click(selectMode);

    // Lock the first.
    list = await piecesList(user, panel);
    await user.click(rows()[0]);
    let card = await screen.findByRole('region', { name: /^Selected piece: / });
    await user.click(within(card).getByRole('button', { name: 'Lock' }));
    await waitFor(() =>
      expect(within(card).getByRole('button', { name: 'Unlock' })).toBeTruthy(),
    );

    // Push the middle one 34 mm into the third (they stand side by side): From left + 34.
    list = await piecesList(user, panel);
    await user.click(rows()[1]);
    card = await screen.findByRole('region', { name: /^Selected piece: / });
    const left = within(card).getByLabelText('From left') as HTMLInputElement;
    const x = Number(left.value);
    await user.clear(left);
    await user.type(left, String(x + 34));
    await user.tab();

    // Checks → the overlap → the problem banner.
    await user.click(screen.getByRole('tab', { name: /^Checks/ }));
    await user.click(await screen.findByRole('button', { name: /overlap by 34 mm/ }));
    const banner = await screen.findByRole('region', { name: 'Problem and repairs' });
    const why = within(banner).getByText(
      /^Refused: Base cabinet.* \(piece 1\) is locked — unlock it to move it\.$/,
    );
    expect(why).toBeTruthy();
    const refused = within(banner).getByRole('radio', {
      name: /^Move Base cabinet.* \(piece 3\) 34 mm to the right.*Refused: /,
    }) as HTMLInputElement;
    expect(refused.disabled).toBe(true);
    expect(refused.checked).toBe(false);
    // The chosen one applies: moving the middle piece back, the smallest move.
    const chosen = within(banner)
      .getAllByRole('radio')
      .find((r) => (r as HTMLInputElement).checked) as HTMLInputElement;
    expect(chosen.disabled).toBe(false);
    expect(chosen.closest('label')!.textContent).toMatch(
      /^Move Base cabinet.* \(piece 2\) 34 mm to the left · smallest move$/,
    );
    // Tapping the refused one changes nothing: it cannot be chosen or applied.
    await user.click(refused);
    expect(refused.checked).toBe(false);
    expect(chosen.checked).toBe(true);
    await user.click(within(banner).getByRole('button', { name: 'Apply' }));
    expect(
      await screen.findByText(/^Applied: Move Base cabinet.* \(piece 2\) 34 mm to the left\./),
    ).toBeTruthy();
  });
});

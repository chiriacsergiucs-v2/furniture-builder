// @vitest-environment jsdom
// Find-it for the turn handle's presence (ADR-169, N172), in jsdom (ADR-108): the one selected piece has a "Turn …"
// handle; a locked piece and a selection of two have none. The drag itself is the browser script
// (tools/turn-handle/find-it.mjs).
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

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

describe.each(WIDTHS)('turn handle at %ipx (find-it, ADR-169)', (width) => {
  it('one selected piece → a "Turn Base cabinet…" handle; Lock hides it; two selected have none', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    await user.type(within(create).getByRole('textbox'), `Turn ${width}`);
    await user.click(within(create).getByRole('button', { name: 'Create project' }));
    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    const peek = panel.querySelector<HTMLButtonElement>('.sheet-peek');
    if (peek?.getAttribute('aria-expanded') === 'false') await user.click(peek);
    await addPiece(user, panel);

    const plan = await screen.findByRole('figure', { name: /Room plan, seen from above/ });
    const handle = () => within(plan).queryByRole('slider', { name: /^Turn Base cabinet/ });
    await waitFor(() => expect(handle()).toBeTruthy());
    expect(handle()!.getAttribute('aria-valuenow')).toBe('0');

    // ] and [ turn the focused piece by 1°; Shift+] by 15°.
    const piece = within(plan).getByRole('button', { name: /^Base cabinet/ });
    piece.focus();
    await user.keyboard(']');
    await waitFor(() => expect(handle()!.getAttribute('aria-valuenow')).toBe('1'));
    piece.focus();
    await user.keyboard('[[');
    await waitFor(() => expect(handle()!.getAttribute('aria-valuenow')).toBe('0'));
    piece.focus();
    await user.keyboard('{Shift>}]{/Shift}');
    await waitFor(() => expect(handle()!.getAttribute('aria-valuenow')).toBe('15'));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(handle()!.getAttribute('aria-valuenow')).toBe('0'));

    // Locked: no handle. Unlocked again: back.
    const card = await screen.findByRole('region', { name: /^Selected piece: / });
    await user.click(within(card).getByRole('button', { name: 'Lock' }));
    await waitFor(() => expect(handle()).toBeNull());
    await user.click(within(card).getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(handle()).toBeTruthy());

    // Two selected: none.
    await addPiece(user, panel);
    const all = within(panel).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
    if (all) await user.click(all);
    await user.click(within(panel).getByRole('checkbox', { name: 'Select' }));
    const rows = within(within(panel).getByRole('list', { name: 'Pieces' })).getAllByRole('button');
    for (const r of rows) if (r.getAttribute('aria-pressed') !== 'true') await user.click(r);
    await screen.findByRole('region', { name: /^2 pieces selected/ });
    expect(handle()).toBeNull();
  });
});

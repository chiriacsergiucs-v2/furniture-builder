// @vitest-environment jsdom
// Find-it for turn and per-size locks (ADR-171, N174), in jsdom (ADR-108): More actions lists Lock turn, Lock width,
// Lock height, Lock depth and Lock size; the chip names what is locked; a width-locked piece's Width field is off and
// Height still changes; a turn-locked piece refuses Turn with the reason and has no turn handle.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addPiece, openMenu, openSheet, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('turn and size locks at %ipx (find-it, ADR-171)', (width) => {
  it('More actions → Lock turn, Lock width…; the chip names the locks; Width off, Height changes; Turn refused', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    await user.type(within(create).getByRole('textbox'), `Locks ${width}`);
    await user.click(within(create).getByRole('button', { name: 'Create project' }));
    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    await openSheet(user, panel);
    await addPiece(user);
    const card = await screen.findByRole('region', { name: /^Selected piece: / });

    // The five toggles are listed.
    let menu = await openMenu(user, card);
    for (const name of ['Lock turn', 'Lock Width', 'Lock Height', 'Lock Depth', 'Lock size'])
      expect(within(menu).getByRole('button', { name })).toBeTruthy();
    await user.click(within(menu).getByRole('button', { name: 'Lock Width' }));
    await waitFor(() => expect(within(card).getByText('Locked: width')).toBeTruthy());

    // Width is off with the hint; Height still changes.
    const size = within(card).getByRole('group', { name: 'Size of the whole piece' });
    expect((within(size).getByLabelText('Width') as HTMLInputElement).disabled).toBe(true);
    expect(within(size).getByText(/width locked — unlock to change/)).toBeTruthy();
    const height = within(size).getByLabelText('Height') as HTMLInputElement;
    expect(height.disabled).toBe(false);
    await user.clear(height);
    await user.type(height, '900');
    await user.tab();
    await waitFor(() => expect(height.value).toBe('900'));

    // Lock turn: the chip names both; Turn ↺ is refused with the reason; no turn handle on the plan.
    menu = await openMenu(user, card);
    await user.click(within(menu).getByRole('button', { name: 'Lock turn' }));
    await waitFor(() => expect(within(card).getByText('Locked: turn, width')).toBeTruthy());
    await user.click(
      within(card).getByRole('button', { name: 'Turn 90° anticlockwise about its centre' }),
    );
    expect(
      await within(card).findByText(/has its turn locked — unlock it to turn it/),
    ).toBeTruthy();
    const plan = screen.getByRole('figure', { name: /Room plan, seen from above/ });
    expect(within(plan).queryByRole('slider', { name: /^Turn Base cabinet/ })).toBeNull();

    // Unlock both from the menu: the chip goes.
    menu = await openMenu(user, card);
    await user.click(within(menu).getByRole('button', { name: 'Unlock turn' }));
    menu = await openMenu(user, card);
    await user.click(within(menu).getByRole('button', { name: 'Unlock Width' }));
    await waitFor(() => expect(within(card).queryByText(/^Locked: /)).toBeNull());
    expect((within(size).getByLabelText('Width') as HTMLInputElement).disabled).toBe(false);
  });
});

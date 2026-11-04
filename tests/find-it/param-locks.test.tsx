// @vitest-environment jsdom
// Find-it for turn and per-size locks (ADR-171, N174), in jsdom (ADR-108): More actions lists Lock turn, Lock width,
// Lock height, Lock depth and Lock size; the chip names what is locked; a width-locked piece's Width field is off and
// Height still changes; a turn-locked piece refuses Turn with the reason and has no turn handle.
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
async function openMenu(user: User, card: HTMLElement) {
  await user.click(within(card).getByRole('button', { name: 'More actions' }));
  return screen.findByRole('group', { name: 'More actions' });
}

describe.each(WIDTHS)('turn and size locks at %ipx (find-it, ADR-171)', (width) => {
  it('More actions → Lock turn, Lock width…; the chip names the locks; Width off, Height changes; Turn refused', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    await user.type(within(create).getByRole('textbox'), `Locks ${width}`);
    await user.click(within(create).getByRole('button', { name: 'Create project' }));
    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    const peek = panel.querySelector<HTMLButtonElement>('.sheet-peek');
    if (peek?.getAttribute('aria-expanded') === 'false') await user.click(peek);
    await addPiece(user, panel);
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

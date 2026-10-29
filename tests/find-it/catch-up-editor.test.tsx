// @vitest-environment jsdom
// Catch-up find-it (ADR-066, user 2026-10-28 "All find it") for the light rows N75 (ADR-080), N110 (ADR-111) and
// N119 (ADR-120), in jsdom (ADR-108): from the bare app, by role and visible text, at 1280 and 390 px.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PHONE_WIDTH, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('editor catch-up at %ipx (find-it, N75, N110, N119)', (width) => {
  it('modes, info buttons, Settings, linked copies, turn, plan checkboxes, Projects row, Back to the editor', async () => {
    const phone = width === PHONE_WIDTH;
    const { user } = await renderApp(width);
    const name = `Catch-up ${width}`;
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    await user.clear(within(create).getByRole('textbox'));
    await user.type(within(create).getByRole('textbox'), name);
    await user.click(within(create).getByRole('button', { name: 'Create project' }));

    // N75: the two modes and Settings in the bar.
    expect(screen.getByRole('radio', { name: 'Compose' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Build & Preview/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();

    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    const peek = panel.querySelector<HTMLButtonElement>('.sheet-peek');
    if (peek?.getAttribute('aria-expanded') === 'false') await user.click(peek);
    await user.click(within(panel).getByRole('button', { name: 'Add a piece' }));
    const dlg = await screen.findByRole('dialog');
    await user.type(within(dlg).getByRole('searchbox', { name: 'Search the items' }), 'Base');
    await user.click(
      within(dlg).getAllByRole('button', { name: /Base cabinet, doors: 1 door/ })[0],
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const placeRight = screen.queryByRole('button', { name: 'Place to the right' });
    if (placeRight) await user.click(placeRight);

    // N75: the plan's and the front view's info buttons.
    expect(await screen.findByRole('button', { name: 'About the plan' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'About the front view' })).toBeTruthy();

    // N119: Select stays in the plan row; Snap is in the row on a desktop, behind Options on a phone (ADR-144).
    // The front view and the piece list have their own Select too (ADR-159): this one is the plan's.
    const plan = screen.getByRole('figure', { name: /Room plan/ });
    expect(within(plan).getByRole('checkbox', { name: 'Select' })).toBeTruthy();
    if (phone) await user.click(within(plan).getByText('Options'));
    expect(screen.getByRole('checkbox', { name: 'Snap' })).toBeTruthy();

    // N119: the turn label says where the front faces; N110: a linked copy.
    const list = within(panel).getByRole('list', { name: 'Pieces' });
    await user.click(within(list).getAllByRole('button')[0]);
    const card = within(panel).getByRole('region', { name: /^Selected piece: / });
    await user.click(within(card).getByText('Position', { selector: 'summary' }));
    expect(within(card).getByText('Turn · front faces you')).toBeTruthy();
    await user.click(within(card).getByRole('button', { name: 'Add a linked copy' }));
    await user.click(within(list).getAllByRole('button')[0]);
    const card2 = within(panel).getByRole('region', { name: /^Selected piece: / });
    expect(await within(card2).findByText('Linked: 2 copies')).toBeTruthy();
    expect(within(card2).getByRole('checkbox', { name: 'Change all copies' })).toBeTruthy();

    // N119: Back to the editor from the Catalog.
    await user.click(screen.getAllByRole('link', { name: /Catalog/ })[0]);
    await user.click(await screen.findByRole('button', { name: /Back to the editor/ }));
    expect(await screen.findByRole('complementary', { name: 'Compose' })).toBeTruthy();

    // N75, N119: Projects row — Settings for <name> on a desktop, the ⋯ Actions menu on a small phone.
    await user.click(screen.getAllByRole('link', { name: /Projects/ })[0]);
    // The project row appears once the autosave has written it.
    const row = await screen.findByText(name, { selector: 'strong' }, { timeout: 5000 });
    const li = within(row.closest('li')!);
    if (phone) {
      await user.click(li.getByLabelText(`Actions for ${name}`));
      expect(li.getByRole('button', { name: 'Settings' })).toBeTruthy();
    } else {
      expect(li.getByRole('button', { name: `Settings for ${name}` })).toBeTruthy();
    }
  });
});

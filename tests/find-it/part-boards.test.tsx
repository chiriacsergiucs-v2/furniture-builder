// @vitest-environment jsdom
// Find-it for part boards (N152, G-299; Material → Part since ADR-163), in jsdom (ADR-108): any single part of a
// piece gets its own board from the Material dialog.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('part boards at %ipx (find-it, ADR-108)', (width) => {
  it('bare app → Chest of drawers → Material → Part → Left side → its own board', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const picker = await screen.findByRole('dialog');
    await user.click(within(picker).getAllByRole('button', { name: /Chest of drawers/ })[0]);

    const openMaterial = async () => {
      await user.click(await screen.findByRole('button', { name: 'Material' }));
      const dlg = await screen.findByRole('dialog', { name: 'Material' });
      await user.click(within(dlg).getByRole('radio', { name: 'Part' }));
      return dlg;
    };
    let dlg = await openMaterial();
    const partSelect = within(dlg).getByRole('combobox', { name: 'Part' });
    const left = within(partSelect).getByRole('option', { name: /^Left side — PAL 18 white/ });
    await user.selectOptions(partSelect, left);
    await user.selectOptions(
      within(dlg).getByRole('combobox', { name: 'Board' }),
      'PAL 18 oak, 18 mm',
    );
    await user.click(within(dlg).getByRole('button', { name: 'Apply material' }));
    expect(within(dlg).getByRole('status').textContent).toBe('Left side: board set.');
    const plinth = within(partSelect).getByRole('option', { name: /^Plinth — / });
    await user.selectOptions(partSelect, plinth);
    await user.selectOptions(
      within(dlg).getByRole('combobox', { name: 'Board' }),
      'PAL 18 oak, 18 mm',
    );
    await user.click(within(dlg).getByRole('button', { name: 'Apply material' }));
    await user.click(within(dlg).getByRole('button', { name: 'Close' }));

    // The parts list shows the left side under its own board.
    await user.click(screen.getByRole('tab', { name: /^Parts/ }));
    const oak = screen
      .getAllByRole('table')
      .find((t) => t.querySelector('caption')?.textContent?.includes('PAL 18 oak'))!;
    expect(within(oak).getByText('Left side')).toBeTruthy();

    // Wall brackets drop the plinth: its board choice is kept and warned about, and Clear removes it.
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog');
    await user.click(within(settings).getByRole('radio', { name: 'Wall brackets' }));
    await user.click(within(settings).getByRole('button', { name: 'Done' }));
    dlg = await openMaterial();
    expect(within(dlg).getByText(/no longer exists; its board is not used/)).toBeTruthy();
    await user.click(within(dlg).getByRole('button', { name: 'Clear' }));
    expect(within(dlg).queryByText(/no longer exists/)).toBeNull();
    expect(
      within(within(dlg).getByRole('combobox', { name: 'Part' })).getByRole('option', {
        name: /^Left side — PAL 18 oak/,
      }),
    ).toBeTruthy();
  });
});

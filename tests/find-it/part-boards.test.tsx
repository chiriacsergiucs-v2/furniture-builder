// @vitest-environment jsdom
// Find-it for part boards (N152, G-299), in jsdom (ADR-108): any single part of a piece gets its own board.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('part boards at %ipx (find-it, ADR-108)', (width) => {
  it('bare app → Chest of drawers → Settings → Part boards → Left side → its own board', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const picker = await screen.findByRole('dialog');
    await user.click(within(picker).getAllByRole('button', { name: /Chest of drawers/ })[0]);

    const openSettings = async () => {
      await user.click(await screen.findByRole('button', { name: 'Settings' }));
      const dlg = await screen.findByRole('dialog');
      await user.click(within(dlg).getByText('Part boards'));
      return dlg;
    };
    let dlg = await openSettings();
    const left = within(dlg).getByRole('combobox', { name: 'Left side' });
    expect((left as HTMLSelectElement).selectedOptions[0].textContent).toBe('Same as its group');
    await user.selectOptions(left, 'PAL 18 oak');
    await user.selectOptions(within(dlg).getByRole('combobox', { name: 'Plinth' }), 'PAL 18 oak');
    await user.click(within(dlg).getByRole('button', { name: 'Done' }));

    // The parts list shows the left side under its own board.
    await user.click(screen.getByRole('tab', { name: /^Parts/ }));
    const oak = screen
      .getAllByRole('table')
      .find((t) => t.querySelector('caption')?.textContent?.includes('PAL 18 oak'))!;
    expect(within(oak).getByText('Left side')).toBeTruthy();

    // Wall brackets drop the plinth: its board choice is kept and warned about, and Clear removes it.
    dlg = await openSettings();
    await user.click(within(dlg).getByRole('radio', { name: 'Wall brackets' }));
    expect(within(dlg).getByText(/no longer exists; its board is not used/)).toBeTruthy();
    await user.click(within(dlg).getByRole('button', { name: 'Clear' }));
    expect(within(dlg).queryByText(/no longer exists/)).toBeNull();
    expect(
      (within(dlg).getByRole('combobox', { name: 'Left side' }) as HTMLSelectElement)
        .selectedOptions[0].textContent,
    ).toBe('PAL 18 oak');
  });
});

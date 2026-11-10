// @vitest-environment jsdom
// Find-it for ADR-263 (UI audit, Saving) at 1280 and 390 px: Restore a .zip of a file that is not a backup says no
// backup files were found, in the Saved data dialog reached from the More menu.
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('saved data at %ipx (find-it, ADR-263)', (width) => {
  it('a file that is not a backup is said as such', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    await user.click(
      within(await screen.findByRole('dialog')).getAllByRole('button', {
        name: /Chest of drawers/,
      })[0],
    );
    await user.click(screen.getByLabelText('More'));
    await user.click(await screen.findByRole('button', { name: /Saved data and backup/ }));
    const dlg = await screen.findByRole('dialog', { name: 'Saved data and backup' });
    const input = within(dlg).getByLabelText('Restore a .zip', {
      selector: 'input',
    }) as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['{}'], 'notes.json', { type: 'application/json' })],
    });
    fireEvent.change(input);
    expect(await within(dlg).findByText(/^No backup files found in notes\.json\./)).toBeTruthy();
  });
});

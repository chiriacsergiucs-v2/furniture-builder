// @vitest-environment jsdom
// Find-it for audit F-02 (UI flow audit 2026-11-15) at 1280 and 390 px: the More menu stays a disclosure, and its
// entries are reached with the arrow keys; picking one returns focus to the More button.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('More menu keyboard at %ipx (find-it, F-02)', (width) => {
  it('arrow keys move through the entries, Home and End jump, Escape returns focus', async () => {
    const { user } = await renderApp(width);
    const more = screen.getByLabelText(/^More$/);
    await user.click(more);
    more.focus();
    await user.keyboard('{ArrowDown}');
    const first = screen.getByRole('button', { name: /^New…/ });
    expect(document.activeElement).toBe(first);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).not.toBe(first);
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(first);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /^Information and guides/ }),
    );
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(first);
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(first);
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(more);
  });

  it('Escape closes the menu when focus is not inside it (Safari does not focus the summary, G-374)', async () => {
    const { user } = await renderApp(width);
    const more = screen.getByLabelText(/^More$/);
    await user.click(more);
    (document.activeElement as HTMLElement | null)?.blur();
    expect(screen.getByRole('button', { name: /^New…/ })).toBeTruthy();
    const details = more.closest('details')!;
    expect(details.open).toBe(true);
    await user.keyboard('{Escape}');
    expect(details.open).toBe(false);
  });

  it('picking an entry closes the menu and puts focus on the More button', async () => {
    const { user } = await renderApp(width);
    const more = screen.getByLabelText(/^More$/);
    await user.click(more);
    await user.click(screen.getByRole('button', { name: /^Clean up unused pictures/ }));
    await within(document.body).findByText('No unused pictures on this device.');
    expect(document.activeElement).toBe(more);
  });
});

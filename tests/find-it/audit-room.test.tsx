// @vitest-environment jsdom
// Find-it for ADR-257 (UI audit, Room and walls) at 1280 and 390 px: a ready shape's wrong size is named at its own
// field, and the floor picture's file input is named for what it does.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openSheet, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('room sizes at %ipx (find-it, ADR-257)', (width) => {
  it('an L-shape cut-out as wide as the room marks Cut-out width with the reason', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    await user.click(within(create).getByRole('button', { name: 'Create project' }));
    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    await openSheet(user, panel);
    await user.click(await screen.findByRole('button', { name: 'Add the room' }));
    await openSheet(user, panel);
    const room = screen.getByRole('region', { name: 'Room' });
    await user.click(within(room).getByRole('radio', { name: 'L-shape' }));
    const cut = within(room).getByLabelText('Cut-out width') as HTMLInputElement;
    const width0 = (within(room).getByLabelText('Room width') as HTMLInputElement).value;
    await user.clear(cut);
    await user.type(cut, `${width0}{Enter}`);
    const cut2 = within(screen.getByRole('region', { name: 'Room' })).getByLabelText(
      'Cut-out width',
    );
    expect(cut2.getAttribute('aria-invalid')).toBe('true');
    expect(
      within(screen.getByRole('region', { name: 'Room' })).getByText(/must be less than the width/),
    ).toBeTruthy();
  });
});

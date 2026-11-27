// @vitest-environment jsdom
// Find-it for ADR-299 (G-406) at 1280 and 390 px: after Add outlet, the Room section shows "Outlet distances (your
// rule)" with three empty fields (no built-in value); a typed distance is kept, a bad one is marked at its field.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openSheet, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('outlet distances at %ipx (find-it, ADR-299)', (width) => {
  it('the user sets their own outlet distances; empty by default', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    await user.click(within(create).getByRole('button', { name: 'Create project' }));
    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    await openSheet(user, panel);
    await user.click(await screen.findByRole('button', { name: 'Add the room' }));
    await openSheet(user, panel);
    const room = () => screen.getByRole('region', { name: 'Room' });
    expect(within(room()).queryByText('Outlet distances (your rule)')).toBeNull();
    await user.click(within(room()).getByRole('button', { name: 'Add outlet' }));
    expect(within(room()).getByText('Outlet distances (your rule)')).toBeTruthy();
    const sink = () => within(room()).getByLabelText('Outlet to a sink') as HTMLInputElement;
    expect(sink().value).toBe('');
    expect((within(room()).getByLabelText('Outlet to a hob') as HTMLInputElement).value).toBe('');
    expect((within(room()).getByLabelText('Outlet to a pipe') as HTMLInputElement).value).toBe('');
    await user.type(sink(), '600{Enter}');
    expect(sink().value).toBe('600');
    const pipe = within(room()).getByLabelText('Outlet to a pipe') as HTMLInputElement;
    await user.type(pipe, '0{Enter}');
    expect(pipe.getAttribute('aria-invalid')).toBe('true');
    expect(
      within(room()).getByText('A whole number of 1 mm or more, or empty for no check.'),
    ).toBeTruthy();
  });
});

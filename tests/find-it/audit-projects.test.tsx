// @vitest-environment jsdom
// Find-it for ADR-261 (UI audit, Projects) at 1280 and 390 px: a project variable whose value has a problem is marked
// and points to it.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('project variables at %ipx (find-it, ADR-261)', (width) => {
  it('a value with a problem is aria-invalid and described by its problem', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    await user.click(within(create).getByRole('button', { name: 'Create project' }));
    await screen.findByRole('complementary', { name: 'Compose' });
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog', { name: /^Settings: / });
    await user.type(within(settings).getByLabelText('New variable'), 'w');
    await user.type(within(settings).getByLabelText('Value or formula'), 'nope +');
    await user.click(within(settings).getByRole('button', { name: 'Add variable' }));
    const value = await within(settings).findByLabelText('Value of w');
    expect(value.getAttribute('aria-invalid')).toBe('true');
    const id = value.getAttribute('aria-describedby')!;
    expect(id).toBeTruthy();
    expect(
      within(settings)
        .getAllByRole('alert')
        .some((a) => a.id === id),
    ).toBe(true);
  });
});

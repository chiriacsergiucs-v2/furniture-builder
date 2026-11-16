// @vitest-environment jsdom
// Find-it for G-519 (N318) in jsdom (ADR-108), on a phone: Escape inside the "Save as project template" form leaves
// Settings open behind it (as Cancel does); one Escape does not close both.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openSheet, renderApp } from './setup';

describe('Escape in a form inside the Settings sheet (find-it, G-519)', () => {
  it('390 px: Escape in Save as project template does not close Settings', async () => {
    const { user } = await renderApp(390);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    await user.clear(within(create).getByRole('textbox'));
    await user.type(within(create).getByRole('textbox'), 'Esc project');
    await user.click(within(create).getByRole('button', { name: 'Create project' }));

    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    await openSheet(user, panel);
    await user.click(within(panel).getByRole('button', { name: 'Add a piece' }));
    const dlg = await screen.findByRole('dialog');
    await user.type(within(dlg).getByRole('searchbox', { name: 'Search the items' }), 'Base');
    await user.click(
      within(dlg).getAllByRole('button', { name: /Base cabinet, doors: 1 door/ })[0],
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog', { name: /^Settings/, hidden: true });
    await user.click(
      within(settings).getByRole('button', { name: 'Save as project template', hidden: true }),
    );
    // In a browser the form's field has the focus, so Escape starts there (jsdom does not move the focus).
    await user.click(
      await screen.findByRole('textbox', { name: 'Name of the project template', hidden: true }),
    );

    await user.keyboard('{Escape}');
    expect(
      screen.getByRole('dialog', { name: /^Settings/, hidden: true }).hasAttribute('open'),
    ).toBe(true);
  });
});

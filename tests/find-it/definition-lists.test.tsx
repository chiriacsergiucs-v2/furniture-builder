// @vitest-environment jsdom
// Find-it for ADR-307 (N451) in jsdom (ADR-108): definition lists — from the bare app, by role and visible text, at
// desktop and phone widths. Precedence, propagation, deletes, settings and templates are proven in
// tests/definition-lists.test.ts; this path finds each feature by its visible text.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { projectWithTwoPieces, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('ADR-307 at %ipx (find-it)', (width) => {
  it('Settings › Definition lists › Add list; a value; the piece’s Definition list select; the piece follows; own value; Use list value', async () => {
    const { user } = await renderApp(width);
    await projectWithTwoPieces(user);

    // A variable the piece's height is bound to.
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    let settings = await screen.findByRole('dialog', { name: /^Settings: / });
    await user.type(within(settings).getByLabelText('New variable'), 'h');
    await user.type(within(settings).getByLabelText('Value or formula'), '400');
    await user.click(within(settings).getByRole('button', { name: 'Add variable' }));

    // Definition lists: Add list gives List A; its value of h is 700.
    expect(within(settings).getByRole('heading', { name: 'Definition lists' })).toBeTruthy();
    await user.click(within(settings).getByRole('button', { name: 'Add list' }));
    const listA = within(settings).getByRole('group', { name: 'List A' });
    expect(within(listA).getByText('used by 0 pieces')).toBeTruthy();
    await user.type(within(listA).getByLabelText('h in List A'), '700');
    await user.tab();
    await waitFor(() => expect(within(listA).getByText('700 mm')).toBeTruthy());
    expect(within(listA).getByLabelText('Carcass board')).toBeTruthy();
    expect(within(listA).getByLabelText('Handle')).toBeTruthy();
    await user.click(within(settings).getByRole('button', { name: 'Done' }));

    const card = await screen.findByRole('region', { name: /^Selected piece: / });
    await user.click(within(card).getByRole('button', { name: 'Bind Height to a variable' }));
    const bind = await screen.findByRole('dialog', { name: 'Bind Height' });
    await user.click(within(bind).getByRole('button', { name: /^h = 400/ }));
    await user.click(within(bind).getByRole('button', { name: 'Bind' }));
    const height = within(card).getByLabelText('Height') as HTMLInputElement;
    await waitFor(() => expect(height.value).toBe('400'));

    // Link the piece to List A: its height follows the list.
    await user.click(within(card).getByText('Definition list', { selector: 'summary' }));
    await user.selectOptions(within(card).getByLabelText('Definition list'), 'List A');
    await waitFor(() => expect(height.value).toBe('700'));
    expect(within(card).getByText(/\(from List A\)/)).toBeTruthy();

    // Its own value wins; Use list value puts the list's back.
    await user.type(within(card).getByLabelText('Own value of h'), '650');
    await user.tab();
    await waitFor(() => expect(height.value).toBe('650'));
    await user.click(within(card).getByRole('button', { name: 'Use list value' }));
    await waitFor(() => expect(height.value).toBe('700'));

    // The list says it is used.
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    settings = await screen.findByRole('dialog', { name: /^Settings: / });
    expect(
      within(within(settings).getByRole('group', { name: 'List A' })).getByText('used by 1 piece'),
    ).toBeTruthy();
  });
});

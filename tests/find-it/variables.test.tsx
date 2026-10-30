// @vitest-environment jsdom
// Find-it for ADR-163 (N165) in jsdom (ADR-108): project variables and bindings — from the bare app, by role and
// visible text, at desktop and phone widths. ADR-164's sets, rooms and 3D are checked by the browser script
// `tools/variables/find-it.mjs` (Acceptance: browser).
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

type User = Awaited<ReturnType<typeof renderApp>>['user'];

/** Bare app → ⋯ › New… › Project with several pieces → Compose, with two base cabinets. */
async function projectWithTwoPieces(user: User) {
  await user.click(screen.getByLabelText('More'));
  await user.click(await screen.findByRole('button', { name: /New…/ }));
  const dlg = await screen.findByRole('dialog', { name: 'Start something new' });
  await user.click(within(dlg).getByRole('button', { name: /Project with several pieces/ }));
  await user.click(await screen.findByRole('radio', { name: 'Compose' }));
  for (let i = 0; i < 2; i++) {
    await user.click(await screen.findByRole('button', { name: 'Add a piece' }));
    const list = await screen.findByRole('dialog', { name: 'Add a piece' });
    await user.click(within(list).getAllByRole('button', { name: /Base cabinet, doors/ })[0]);
  }
}

describe.each(WIDTHS)('ADR-163 at %ipx (find-it)', (width) => {
  it('Settings › Variables › Add variable; ƒ by Height binds it; 450 follows; Delete asks and unbinds', async () => {
    const { user } = await renderApp(width);
    await projectWithTwoPieces(user);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog', { name: /^Settings: / });
    expect(within(settings).getByRole('heading', { name: 'Variables' })).toBeTruthy();
    await user.type(within(settings).getByLabelText('New variable'), 'bottom height');
    await user.type(within(settings).getByLabelText('Value or formula'), '400');
    await user.click(within(settings).getByRole('button', { name: 'Add variable' }));
    expect(within(settings).getByLabelText('Value of bottom height')).toBeTruthy();
    expect(within(settings).getByText('400 mm')).toBeTruthy();
    await user.click(within(settings).getByRole('button', { name: 'Done' }));

    const card = await screen.findByRole('region', { name: /^Selected piece: / });
    await user.click(within(card).getByRole('button', { name: 'Bind Height to a variable' }));
    const bind = await screen.findByRole('dialog', { name: 'Bind Height' });
    await user.click(within(bind).getByRole('button', { name: /^bottom height = 400/ }));
    expect(within(bind).getByText('= 400 mm')).toBeTruthy();
    await user.click(within(bind).getByRole('button', { name: 'Bind' }));
    await waitFor(() => expect(within(card).getByText('bottom height = 400')).toBeTruthy());
    const height = within(card).getByLabelText('Height') as HTMLInputElement;
    expect(height.value).toBe('400');
    expect(height.disabled).toBe(true);

    // The Compose fold: change the value in place; the piece follows.
    const strip = screen.getByRole('region', { name: 'Variables' });
    const value = within(strip).getByLabelText('Value of bottom height');
    await user.clear(value);
    await user.type(value, '450');
    await user.tab();
    await waitFor(() => expect(height.value).toBe('450'));
    expect(within(card).getByText('bottom height = 450')).toBeTruthy();

    // Delete asks, lists the piece, and unbinds it; the piece keeps 450.
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const again = await screen.findByRole('dialog', { name: /^Settings: / });
    expect(within(again).getByText('used by 1 piece')).toBeTruthy();
    await user.click(within(again).getByRole('button', { name: 'Delete bottom height' }));
    const confirm = await screen.findByRole('dialog', { name: 'Confirm' });
    expect(confirm.textContent).toMatch(/Delete “bottom height”\?.*Base cabinet/);
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(within(again).queryByLabelText('Value of bottom height')).toBeNull(),
    );
    await user.click(within(again).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(height.disabled).toBe(false));
    expect(height.value).toBe('450');
  });

  it('a formula with a problem is shown in the bind sheet and Bind stays off', async () => {
    const { user } = await renderApp(width);
    await projectWithTwoPieces(user);
    const card = await screen.findByRole('region', { name: /^Selected piece: / });
    await user.click(within(card).getByRole('button', { name: 'Bind Width to a variable' }));
    const bind = await screen.findByRole('dialog', { name: 'Bind Width' });
    expect(within(bind).getByText(/No variables yet/)).toBeTruthy();
    await user.type(within(bind).getByLabelText('Formula'), 'nothing + 1');
    expect((await within(bind).findByRole('alert')).textContent).toMatch(
      /Unknown variable “nothing”/,
    );
    expect((within(bind).getByRole('button', { name: 'Bind' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

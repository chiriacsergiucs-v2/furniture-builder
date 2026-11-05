// @vitest-environment jsdom
// Find-it for templates that keep variables (ADR-170, N173), in jsdom (ADR-108): a project with a variable saved as
// a project template, inserted again from Add a piece → the project still has one variable and the inserted piece is
// bound to it; Information and guides names what a template keeps.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

type User = Awaited<ReturnType<typeof renderApp>>['user'];

async function piecesList(user: User, panel: HTMLElement) {
  const all = within(panel).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
  if (all) await user.click(all);
  return within(panel).getByRole('list', { name: 'Pieces' });
}

describe.each(WIDTHS)('templates keep variables at %ipx (find-it, ADR-170)', (width) => {
  it('project → variable bound to Height → Save as project template → insert it → one variable, both pieces bound', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    await user.type(within(create).getByRole('textbox'), `Keeps ${width}`);
    await user.click(within(create).getByRole('button', { name: 'Create project' }));

    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    const peek = panel.querySelector<HTMLButtonElement>('.sheet-peek');
    if (peek?.getAttribute('aria-expanded') === 'false') await user.click(peek);
    await user.click(within(panel).getByRole('button', { name: 'Add a piece' }));
    let dlg = await screen.findByRole('dialog');
    await user.type(within(dlg).getByRole('searchbox', { name: 'Search the items' }), 'Base');
    await user.click(
      within(dlg).getAllByRole('button', { name: /Base cabinet, doors: 1 door/ })[0],
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const placeRight = screen.queryByRole('button', { name: 'Place to the right' });
    if (placeRight) await user.click(placeRight);

    // A variable, bound to the piece's height.
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog', { name: /^Settings: / });
    await user.type(within(settings).getByLabelText('New variable'), 'base height');
    await user.type(within(settings).getByLabelText('Value or formula'), '650');
    await user.click(within(settings).getByRole('button', { name: 'Add variable' }));
    expect(within(settings).getByLabelText('Value of base height')).toBeTruthy();
    await user.click(within(settings).getByRole('button', { name: 'Done' }));
    const card = await screen.findByRole('region', { name: /^Selected piece: / });
    await user.click(within(card).getByRole('button', { name: 'Bind Height to a variable' }));
    const bind = await screen.findByRole('dialog', { name: 'Bind Height' });
    await user.click(within(bind).getByRole('button', { name: /^base height = 650/ }));
    await user.click(within(bind).getByRole('button', { name: 'Bind' }));
    await waitFor(() => expect(within(card).getByText('base height = 650')).toBeTruthy());

    // Save as a project template, then insert it.
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const again = await screen.findByRole('dialog', { name: /^Settings: / });
    await user.click(within(again).getByRole('button', { name: 'Save as project template' }));
    const name = await screen.findByRole('dialog', { name: 'Save as project template' });
    await user.click(within(name).getByRole('button', { name: 'Save template' }));
    await within(again).findByText(/Saved as project template/);
    await user.click(within(again).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await user.click(within(panel).getByRole('button', { name: 'Add a piece' }));
    dlg = await screen.findByRole('dialog');
    const list = within(dlg).getByRole('list', { name: 'Project templates' });
    await user.click(within(list).getByRole('button', { name: new RegExp(`Keeps ${width}`) }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((await piecesList(user, panel)).children).toHaveLength(2);
    // The project kept its own variable; the inserted piece follows it.
    expect(await screen.findByText(/Kept the project’s “base height”/)).toBeTruthy();
    const strip = screen.getByRole('region', { name: 'Variables' });
    expect(within(strip).getAllByLabelText(/^Value of /)).toHaveLength(1);
    const rows = within(await piecesList(user, panel)).getAllByRole('button');
    await user.click(rows[1]);
    const card2 = await screen.findByRole('region', { name: /^Selected piece: / });
    expect(await within(card2).findByText('base height = 650')).toBeTruthy();

    // Information and guides names what a template keeps.
    await user.click(screen.getByLabelText('More'));
    await user.click(await screen.findByRole('button', { name: /Information and guides/ }));
    expect(
      await screen.findByText(
        /connections, variables and bindings; pieces inserted into a project take its settings/,
      ),
    ).toBeTruthy();
  });
});

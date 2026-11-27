// @vitest-environment jsdom
// Find-it for ADR-302 (G-014), in jsdom (ADR-108), at 390 and 1280 px: Projects → Delete a saved project → it is
// listed under "Recently deleted (1)" → Restore brings it back to the Projects list; Delete forever asks first.
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { newProjectNamed, renderApp, toProjects, WIDTHS } from './setup';

type User = Awaited<ReturnType<typeof renderApp>>['user'];

/** The Delete action of a saved row: a button on a wide screen, in the row's ⋯ menu on a phone. */
async function deleteRow(user: User, name: string, width: number) {
  const page = screen.getByRole('main', { name: 'Projects' });
  if (width < 520) {
    const menu = await within(page).findByLabelText(`Actions for ${name}`);
    await user.click(menu);
    const details = menu.closest('details')!;
    await user.click(within(details as HTMLElement).getByRole('button', { name: 'Delete' }));
  } else await user.click(await within(page).findByRole('button', { name: `Delete ${name}` }));
}

describe.each(WIDTHS)('Recently deleted on Projects at %ipx (find-it, ADR-302)', (width) => {
  it('Projects › Delete → Recently deleted → Restore brings the project back', async () => {
    const { user } = await renderApp(width);
    const dbm = await import('../../src/persist/db');
    const { newProject } = await import('../../src/core/project');
    const { templates } = await import('../../src/core/design');
    // The storage of one test file is shared between its runs: names per width, and an empty Recently deleted.
    await dbm.db.recentlyDeleted.clear();
    const name = `Hall wardrobe ${width}`;
    const piece = `Shoe rack ${width}`;
    await dbm.saveProject(newProject(name));
    await dbm.saveDesign({ ...templates[0].create(), name: piece });
    await newProjectNamed(user, 'Open now project');
    await toProjects(user);
    const page = screen.getByRole('main', { name: 'Projects' });
    await within(page).findByText(name);

    // Delete says where it goes.
    await deleteRow(user, name, width);
    let ask = await screen.findByRole('dialog', { name: 'Confirm' });
    expect(ask.textContent).toContain(
      `Delete project “${name}”? It stays in Recently deleted for 30 days.`,
    );
    await user.click(within(ask).getByRole('button', { name: 'Delete' }));
    await vi.waitFor(
      () =>
        expect(
          within(within(page).getByRole('list', { name: 'Projects' })).queryByText(name),
        ).toBeNull(),
      { timeout: 5000 },
    );

    // The piece goes there too.
    await deleteRow(user, piece, width);
    ask = await screen.findByRole('dialog', { name: 'Confirm' });
    await user.click(within(ask).getByRole('button', { name: 'Delete' }));

    const folded = await within(page).findByText(
      'Recently deleted (2)',
      { selector: 'summary' },
      { timeout: 5000 },
    );
    await user.click(folded);
    const list = within(page).getByRole('list', { name: 'Recently deleted (2)' });
    expect(within(list).getByText(name)).toBeTruthy();
    expect(within(list).getByText(piece)).toBeTruthy();

    // Delete forever asks first; Cancel keeps it, Delete forever removes it.
    await user.click(within(list).getByRole('button', { name: `Delete ${piece} forever` }));
    ask = await screen.findByRole('dialog', { name: 'Confirm' });
    await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
    expect(await dbm.db.recentlyDeleted.count()).toBe(2);
    await user.click(within(list).getByRole('button', { name: `Delete ${piece} forever` }));
    ask = await screen.findByRole('dialog', { name: 'Confirm' });
    await user.click(within(ask).getByRole('button', { name: 'Delete forever' }));
    const one = await within(page).findByRole('list', { name: 'Recently deleted (1)' });

    // Restore brings the project back to the list.
    await user.click(within(one).getByRole('button', { name: `Restore ${name}` }));
    const projects = await within(page).findByRole('list', { name: 'Projects' });
    expect(await within(projects).findByText(name)).toBeTruthy();
    await vi.waitFor(
      () => expect(within(page).queryByRole('list', { name: /^Recently deleted/ })).toBeNull(),
      { timeout: 5000 },
    );
    expect(await dbm.db.recentlyDeleted.count()).toBe(0);
  });
});

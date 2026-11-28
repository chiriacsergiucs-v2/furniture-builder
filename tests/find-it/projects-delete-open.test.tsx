// @vitest-environment jsdom
// Find-it for deleting the open project, in jsdom (ADR-108), at 390 and 1280 px: Projects → the project marked
// "Open now" has an enabled Delete → confirm → it leaves the list, a new empty project is open, and nothing writes
// the deleted one back.
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { newProjectNamed, renderApp, toProjects, WIDTHS } from './setup';

describe.each(WIDTHS)('Delete the open project at %ipx (find-it)', (width) => {
  it('Projects › Delete on "Open now" → confirm → a new empty project is open', async () => {
    const { user } = await renderApp(width);
    const dbm = await import('../../src/persist/db');
    const name = `Open to delete ${width}`;
    await newProjectNamed(user, name);
    await toProjects(user);
    const page = screen.getByRole('main', { name: 'Projects' });
    const list = await within(page).findByRole('list', { name: 'Projects' });
    const row = (await within(list).findByText(name)).closest('li') as HTMLElement;
    expect(within(row).getByText('Open now')).toBeTruthy();

    if (width < 520) {
      await user.click(within(row).getByLabelText(`Actions for ${name}`));
      const del = within(row).getByRole('button', { name: 'Delete' });
      expect((del as HTMLButtonElement).disabled).toBe(false);
      await user.click(del);
    } else {
      const del = within(row).getByRole('button', { name: `Delete ${name}` });
      expect((del as HTMLButtonElement).disabled).toBe(false);
      await user.click(del);
    }
    const ask = await screen.findByRole('dialog', { name: 'Confirm' });
    await user.click(within(ask).getByRole('button', { name: 'Delete' }));

    await vi.waitFor(() => expect(within(list).queryByText(name)).toBeNull(), { timeout: 5000 });
    // A new project is open now; the deleted one is in Recently deleted, not in the projects store.
    const open = (await within(list).findAllByText('Open now'))[0].closest('li') as HTMLElement;
    expect(within(open).queryByText(name)).toBeNull();
    const { useDesign } = await import('../../src/store/designStore');
    expect(useDesign.getState().project?.name).not.toBe(name);
    expect(useDesign.getState().projectPast).toEqual([]);
    // Wait past the autosave delay: the deleted project is not written back.
    await new Promise((r) => setTimeout(r, 700));
    expect((await dbm.listProjects()).some((p) => p.name === name)).toBe(false);
    expect(
      (await dbm.db.recentlyDeleted.toArray()).some((r) => JSON.stringify(r).includes(name)),
    ).toBe(true);
  });
});

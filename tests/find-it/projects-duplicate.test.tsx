// @vitest-environment jsdom
// Find-it for ADR-227 (validate saved rows before duplicating), in jsdom (ADR-108), at 390 and 1280 px: Projects →
// Duplicate on a saved project and a saved piece adds "<name> (copy)"; Duplicate on a row that cannot be read shows
// "Saved work could not be read from this browser." and adds nothing. Saved data is put in storage first.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

type User = Awaited<ReturnType<typeof renderApp>>['user'];

async function newProjectNamed(user: User, name: string) {
  await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
  const create = await screen.findByRole('dialog');
  const box = within(create).getByRole('textbox');
  await user.clear(box);
  await user.type(box, name);
  await user.click(within(create).getByRole('button', { name: 'Create project' }));
  await screen.findByRole('complementary', { name: 'Compose' });
}

async function toProjects(user: User) {
  await user.click(
    screen
      .queryAllByRole('link', { name: 'Projects' })
      .concat(screen.queryAllByRole('button', { name: 'Projects' }))[0],
  );
  await screen.findByRole('main', { name: 'Projects' });
}

/** The Duplicate action of a saved row: a button on a wide screen, in the row's ⋯ menu on a phone. */
async function duplicateRow(user: User, name: string, width: number) {
  const page = screen.getByRole('main', { name: 'Projects' });
  if (width < 520) {
    const menu = await within(page).findByLabelText(`Actions for ${name}`);
    await user.click(menu);
    const details = menu.closest('details')!;
    await user.click(within(details as HTMLElement).getByRole('button', { name: 'Duplicate' }));
  } else await user.click(await within(page).findByRole('button', { name: `Duplicate ${name}` }));
}

describe.each(WIDTHS)('duplicate saved work at %ipx (find-it, ADR-227)', (width) => {
  it('Projects › Duplicate adds a copy of a readable project and piece, and refuses an unreadable one', async () => {
    const { user } = await renderApp(width);
    // Saved rows are named per width: the storage of one test file is shared between its runs.
    const db = await import('../../src/persist/db');
    const { newProject } = await import('../../src/core/project');
    const { templates } = await import('../../src/core/design');
    await db.saveProject(newProject(`Hall wardrobe ${width}`));
    await db.saveDesign({ ...templates[0].create(), name: `Shoe rack ${width}` });
    const broken = newProject(`Broken project ${width}`);
    await db.db.projects.put({
      id: broken.id,
      name: broken.name,
      updatedAt: broken.updatedAt,
      project: { ...broken, schemaVersion: 99 } as never,
    });
    await newProjectNamed(user, 'Open now project');
    await toProjects(user);
    const page = screen.getByRole('main', { name: 'Projects' });

    await duplicateRow(user, `Hall wardrobe ${width}`, width);
    expect(await within(page).findByText(`Hall wardrobe ${width} (copy)`)).toBeTruthy();
    await duplicateRow(user, `Shoe rack ${width}`, width);
    expect(await within(page).findByText(`Shoe rack ${width} (copy)`)).toBeTruthy();

    const before = await db.db.projects.count();
    await duplicateRow(user, `Broken project ${width}`, width);
    expect((await within(page).findByRole('alert')).textContent).toContain(
      'Saved work could not be read from this browser.',
    );
    expect(within(page).queryByText(`Broken project ${width} (copy)`)).toBeNull();
    expect(await db.db.projects.count()).toBe(before);
  });
});

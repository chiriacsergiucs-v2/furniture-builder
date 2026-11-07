// @vitest-environment jsdom
// Find-it for ADR-223 (N228), in jsdom (ADR-108): the places that save a project still save it once saving goes
// through the library store. From the bare app: Create a new project (the Projects page), Fill a wall and Fill the
// room (Use this mix), Settings › Variables › Save as separate project, and History › Versions of deleted projects ›
// Restore as a new project. Each saved name is then listed when the saved projects are read again from the device.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { projectWithTwoPieces, renderApp, WIDTHS } from './setup';

type User = Awaited<ReturnType<typeof renderApp>>['user'];

/** The names of the projects saved on this device, read again from storage. */
async function savedNames(): Promise<string[]> {
  const { listProjects } = await import('../../src/persist/db');
  return (await listProjects()).map((r) => r.name);
}

async function startNew(user: User, row: RegExp, title: string) {
  await user.click(screen.getByLabelText('More'));
  await user.click(await screen.findByRole('button', { name: /New…/ }));
  const start = await screen.findByRole('dialog', { name: 'Start something new' });
  await user.click(within(start).getByRole('button', { name: row }));
  return screen.findByRole('dialog', { name: title });
}

/** The one project saved since `before` (ids), which is the open one: its name is shown in a field. */
async function savedSince(before: string[]): Promise<void> {
  const { listProjects } = await import('../../src/persist/db');
  const added = (await listProjects()).filter((r) => !before.includes(r.id));
  expect(added).toHaveLength(1);
  expect(await screen.findByDisplayValue(added[0].name)).toBeTruthy();
}

/** The ids of the projects saved on this device. */
async function savedIds(): Promise<string[]> {
  const { listProjects } = await import('../../src/persist/db');
  return (await listProjects()).map((r) => r.id);
}

describe.each(WIDTHS)('saving goes through the library at %ipx (find-it, ADR-223)', (width) => {
  it('Create a new project: the named project is saved', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    const field = within(create).getByRole('textbox');
    await user.clear(field);
    await user.type(field, `Library hall ${width}`);
    await user.click(within(create).getByRole('button', { name: 'Create project' }));
    await screen.findByRole('complementary', { name: 'Compose' });
    await waitFor(async () => expect(await savedNames()).toContain(`Library hall ${width}`));
  });

  it('Fill a wall › Use this mix: the new project is saved before it opens', async () => {
    const { user } = await renderApp(width);
    const dlg = await startNew(user, /^Fill a wall/, 'Fill a wall');
    await user.click(
      within(within(dlg).getByRole('list', { name: 'Fill a wall steps' })).getByRole('button', {
        name: 'Refine',
      }),
    );
    await user.click(within(dlg).getByRole('button', { name: 'Suggest again' }));
    const mixes = await within(dlg).findAllByRole('button', { name: 'Use this mix' });
    const before = await savedIds();
    await user.click(mixes[0]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Fill a wall' })).toBeNull());
    await savedSince(before);
  });

  it('Fill the room › Use this mix: the new project is saved before it opens', async () => {
    const { user } = await renderApp(width);
    const dlg = await startNew(user, /^Fill the room/, 'Fill the room');
    await user.click(within(dlg).getByRole('button', { name: 'Next' }));
    await user.click(within(dlg).getByRole('button', { name: 'Show suggestions' }));
    const mixes = await within(dlg).findAllByRole('button', { name: 'Use this mix' });
    const before = await savedIds();
    await user.click(mixes[0]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Fill the room' })).toBeNull());
    await savedSince(before);
  });

  it('Settings › Variables › Save as separate project: the set is saved as its own project', async () => {
    const { user } = await renderApp(width);
    await projectWithTwoPieces(user);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog', { name: /^Settings: / });
    await user.type(within(settings).getByLabelText('New variable'), 'bottom height');
    await user.type(within(settings).getByLabelText('Value or formula'), '400');
    await user.click(within(settings).getByRole('button', { name: 'Add variable' }));
    await user.click(within(settings).getByRole('button', { name: 'Add set' }));
    const value = await within(settings).findByLabelText(/: value of bottom height$/);
    await user.type(value, '500');
    await user.tab();
    await user.click(
      await within(settings).findByRole('button', { name: 'Save as separate project' }),
    );
    const ask = await screen.findByRole('dialog', { name: 'Confirm' });
    const name = /Saved as “(.+)”\./.exec(ask.textContent ?? '')?.[1];
    expect(name).toBeTruthy();
    expect(await savedNames()).toContain(name);
    await user.click(within(ask).getByRole('button', { name: 'Keep' }));
  });

  it('History › Versions of deleted projects › Restore as a new project: the copy is saved', async () => {
    const { user } = await renderApp(width);
    const dbm = await import('../../src/persist/db');
    const { makeVersion } = await import('../../src/core/projectVersion');
    const { newProject: blank } = await import('../../src/core/project');
    const gone = { ...blank(`Library gone ${width}`), id: `library-gone-${width}` };
    await dbm.saveProjectVersion(makeVersion(gone, 'manual', new Date('2026-11-01T10:00:00Z')));
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    await user.click(within(create).getByRole('button', { name: 'Create project' }));
    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    const history = within(panel).getByText(/^History( · \d+ versions?)?$/, {
      selector: 'summary',
    });
    if (!(history.closest('details') as HTMLDetailsElement).open) await user.click(history);
    const folded = await within(panel).findByText(/^Versions of deleted projects \(\d+\)$/, {
      selector: 'summary',
    });
    if (!(folded.closest('details') as HTMLDetailsElement).open) await user.click(folded);
    const list = within(panel).getByRole('list', { name: /^Versions of deleted projects/ });
    const row = within(list)
      .getAllByRole('listitem')
      .find((li) => within(li).queryByText(`Library gone ${width}`));
    await user.click(within(row!).getByRole('button', { name: 'Restore as a new project' }));
    await screen.findByDisplayValue(`Library gone ${width} (restored)`);
    expect(await savedNames()).toContain(`Library gone ${width} (restored)`);
  });
});

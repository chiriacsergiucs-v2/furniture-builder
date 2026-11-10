// @vitest-environment jsdom
// ADR-261 (UI audit, Projects), through the app at 1280 px: a failed delete is said, Save as separate project saves
// once and says a failed save, a refused Update from saved piece is never called done, and Edit history names its
// first row after 100 steps. (The find-it at both widths is tests/find-it/audit-projects.test.tsx.)
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from './find-it/setup';

const store = vi.hoisted(() => ({ failDelete: false, failSave: false }));
vi.mock('../src/persist/db', async (orig) => {
  const real = await orig<typeof import('../src/persist/db')>();
  return {
    ...real,
    deleteProject: (...a: Parameters<typeof real.deleteProject>) =>
      store.failDelete ? Promise.reject(new Error('QuotaExceededError')) : real.deleteProject(...a),
    saveProject: (...a: Parameters<typeof real.saveProject>) =>
      store.failSave ? Promise.reject(new Error('QuotaExceededError')) : real.saveProject(...a),
  };
});

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

describe('ADR-261 projects', () => {
  it('a delete the storage refuses is said', async () => {
    const { user } = await renderApp(1280);
    const db = await import('../src/persist/db');
    const { newProject } = await import('../src/core/project');
    await db.saveProject(newProject('Old kitchen'));
    await newProjectNamed(user, 'Open one');
    await toProjects(user);
    const page = screen.getByRole('main', { name: 'Projects' });
    await within(page).findByText('Old kitchen');
    store.failDelete = true;
    try {
      await user.click(within(page).getByRole('button', { name: 'Delete Old kitchen' }));
      const c = await screen.findByRole('dialog', { name: 'Confirm' });
      await user.click(within(c).getByRole('button', { name: 'Delete' }));
      expect(
        await within(page).findByText(
          'The project could not be deleted from this browser’s storage.',
        ),
      ).toBeTruthy();
    } finally {
      store.failDelete = false;
    }
  });

  it('Save as separate project saves once per double tap and says a failed save', async () => {
    const { user } = await renderApp(1280);
    const db = await import('../src/persist/db');
    await newProjectNamed(user, 'Sets');
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog', { name: /^Settings: / });
    await user.type(within(settings).getByLabelText('New variable'), 'w');
    await user.type(within(settings).getByLabelText('Value or formula'), '400');
    await user.click(within(settings).getByRole('button', { name: 'Add variable' }));
    await user.click(within(settings).getByRole('button', { name: 'Add set' }));
    await user.type(await within(settings).findByLabelText(/: value of w$/), '500');
    await user.tab();
    const btn = await within(settings).findByRole('button', { name: 'Save as separate project' });
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false));
    store.failSave = true;
    try {
      await user.click(btn);
      expect(
        await within(settings).findByText(
          'The project could not be saved in this browser’s storage.',
        ),
      ).toBeTruthy();
    } finally {
      store.failSave = false;
    }
    const before = (await db.listProjects()).length;
    await user.dblClick(within(settings).getByRole('button', { name: 'Save as separate project' }));
    await waitFor(async () => expect((await db.listProjects()).length).toBe(before + 1));
  });

  it('Update from saved piece on a size-locked piece says why, not Updated', async () => {
    const { user } = await renderApp(1280);
    const db = await import('../src/persist/db');
    const { templates } = await import('../src/core/design');
    const { resizeProduct } = await import('../src/core/pieceSize');
    const { useDesign } = await import('../src/store/designStore');
    await newProjectNamed(user, 'Locked');
    const saved = { ...templates[0].create(), name: 'Saved base' };
    const w = (saved.product.params as unknown as { width: number }).width;
    await db.saveDesign(saved);
    const s = useDesign.getState;
    s().addPiece({ ...saved, product: resizeProduct(saved.product, 'width', w + 200) }, saved.id);
    const id = s().project!.items[0].id;
    s().setSizeLocked(id, true);
    s().selectItem(id);
    const card = await screen.findByRole('region', { name: /^Selected piece: / });
    await user.click(within(card).getByRole('button', { name: 'More actions' }));
    const menu = await screen.findByRole('group', { name: 'More actions' });
    await user.click(within(menu).getByRole('button', { name: /Update from saved piece/ }));
    const c = await screen.findByRole('dialog', { name: 'Confirm' });
    await user.click(within(c).getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(screen.queryByText('Updated from the saved piece.')).toBeNull());
    expect(
      (s().project!.items[0].design.product.params as unknown as { width: number }).width,
    ).toBe(w + 200);
  });

  it('after 100 steps the first history row is the earliest kept step', async () => {
    await renderApp(1280);
    const { useDesign } = await import('../src/store/designStore');
    const { newProject } = await import('../src/core/project');
    const s = useDesign.getState;
    s().openProject(newProject('Steps'));
    expect(s().projectHistoryTrimmed).toBe(false);
    for (let i = 0; i < 101; i++)
      s().updateProject((p) => ({ ...p, cutting: { kerf: (i % 9) + 1 } }));
    expect(s().projectHistoryTrimmed).toBe(true);
    s().openProject(newProject('Fresh'));
    expect(s().projectHistoryTrimmed).toBe(false);
  });
});

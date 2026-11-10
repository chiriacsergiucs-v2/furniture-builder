// @vitest-environment jsdom
// ADR-263 (UI audit, Saving, backup and sharing), through the app at 1280 px with the online part mocked: a refused
// restore says how far it got, a file that is not a backup says so, Clean up keeps pictures a kept version uses, Open
// a copy saves once and says a failed save, a refused clipboard is said, and a Project file that cannot be made is
// said. (The find-it at both widths is tests/find-it/audit-saving.test.tsx.)
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addPiece, openSheet, renderApp } from './find-it/setup';

const store = vi.hoisted(() => ({ failSaveDesign: false, failModels: false }));
vi.mock('../src/persist/db', async (orig) => {
  const real = await orig<typeof import('../src/persist/db')>();
  return {
    ...real,
    saveDesign: (...a: Parameters<typeof real.saveDesign>) =>
      store.failSaveDesign
        ? Promise.reject(new Error('QuotaExceededError'))
        : real.saveDesign(...a),
  };
});
vi.mock('../src/persist/models', async (orig) => {
  const real = await orig<typeof import('../src/persist/models')>();
  return {
    ...real,
    withModels: (...a: Parameters<typeof real.withModels>) =>
      store.failModels ? Promise.reject(new Error('UnknownError')) : real.withModels(...a),
  };
});
const shared = vi.hoisted(() => ({ body: null as unknown }));
vi.mock('../src/online/client', () => ({
  openShare: async () => ({
    ok: true,
    item: { kind: 'design', name: 'Shared desk', body: shared.body },
  }),
  remoteIdOf: async () => null,
  listShares: async () => [],
  createShare: async () => ({ ok: false, error: 'x' }),
  stopShare: async () => {},
  initSession: async () => {},
  restoreSession: async () => null,
}));

type User = Awaited<ReturnType<typeof renderApp>>['user'];
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline'))),
  );
  store.failSaveDesign = false;
  store.failModels = false;
});
afterEach(() => vi.unstubAllGlobals());

async function chest(user: User) {
  await user.click(await screen.findByRole('button', { name: 'New single piece' }));
  await user.click(
    within(await screen.findByRole('dialog')).getAllByRole('button', {
      name: /Chest of drawers/,
    })[0],
  );
}
async function savedDataDialog(user: User) {
  await user.click(screen.getByLabelText('More'));
  await user.click(await screen.findByRole('button', { name: /Saved data and backup/ }));
  return screen.findByRole('dialog', { name: 'Saved data and backup' });
}
function upload(input: HTMLInputElement, f: File) {
  Object.defineProperty(input, 'files', { configurable: true, value: [f] });
  fireEvent.change(input);
}

describe('ADR-263 saving, backup and sharing', () => {
  it('a restore the storage refuses says it stopped', async () => {
    const { user } = await renderApp(1280);
    await chest(user);
    const db = await import('../src/persist/db');
    await waitFor(async () => expect(await db.countDesigns()).toBe(1));
    const { backupZip } = await import('../src/persist/backup');
    const z = await backupZip();
    const bytes = new Uint8Array(await z.blob.arrayBuffer());
    const row = (await db.listDesigns())[0];
    await db.saveDesign({
      ...row.design,
      name: 'Changed after backup',
      updatedAt: new Date().toISOString(),
    });
    store.failSaveDesign = true;
    const dlg = await savedDataDialog(user);
    upload(
      within(dlg).getByLabelText('Restore a .zip', { selector: 'input' }) as HTMLInputElement,
      new File([bytes], z.name, { type: 'application/zip' }),
    );
    expect(await within(dlg).findByText(/^The restore stopped:/)).toBeTruthy();
  });

  it('a file that is not a backup says no backup files were found', async () => {
    const { user } = await renderApp(1280);
    await chest(user);
    const dlg = await savedDataDialog(user);
    upload(
      within(dlg).getByLabelText('Restore a .zip', { selector: 'input' }) as HTMLInputElement,
      new File(['{"name":"my project"}'], 'kitchen-project.json', { type: 'application/json' }),
    );
    expect(
      await within(dlg).findByText(/^No backup files found in kitchen-project\.json\./),
    ).toBeTruthy();
  });

  it('Clean up keeps a picture that a kept project version uses', async () => {
    await renderApp(1280);
    const db = await import('../src/persist/db');
    await db.saveImage({
      id: 'img-wall',
      name: 'wall.jpg',
      type: 'image/jpeg',
      width: 1,
      height: 1,
      bytes: new ArrayBuffer(4),
    } as never);
    await db.saveProjectVersion({
      id: 'v1',
      projectId: 'p1',
      savedAt: new Date().toISOString(),
      kind: 'manual',
      project: { id: 'p1', name: 'Kitchen', items: [], wallPicture: { imageId: 'img-wall' } },
    } as never);
    expect(await db.unusedImageIds()).not.toContain('img-wall');
  });

  it('Open a copy saves one copy per double tap and says a failed save', async () => {
    await renderApp(1280);
    const { useDesign } = await import('../src/store/designStore');
    const { useAccount } = await import('../src/store/accountStore');
    const db = await import('../src/persist/db');
    shared.body = useDesign.getState().design;
    const before = await db.countDesigns();
    useAccount.getState().set({ opening: 'abc' });
    const btn = await screen.findByRole('button', { name: 'Open a copy' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(async () => expect(await db.countDesigns()).toBe(before + 1));
    store.failSaveDesign = true;
    useAccount.getState().set({ opening: 'def' });
    const dlg = await screen.findByRole('dialog', { name: 'Shared desk' });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Open a copy' }));
    expect(
      await within(dlg).findByText('The copy could not be saved in this browser’s storage.'),
    ).toBeTruthy();
  });

  it('a refused clipboard is said, not reported as copied', async () => {
    const { user } = await renderApp(1280);
    await chest(user);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('NotAllowedError')) },
    });
    await user.click(screen.getByLabelText('More'));
    await user.click(await screen.findByRole('button', { name: /Copy code/ }));
    const dlg = await screen.findByRole('dialog', { name: /^Code for / });
    await user.click(await within(dlg).findByRole('button', { name: 'Copy code' }));
    expect(
      await within(dlg).findByText(
        'This browser did not allow copying. Select the link and copy it.',
      ),
    ).toBeTruthy();
    expect(within(dlg).queryByText('Code copied.')).toBeNull();
  });

  it('a Project file that cannot be made is said', async () => {
    const { user } = await renderApp(1280);
    await user.click(screen.getByLabelText('More'));
    await user.click(await screen.findByRole('button', { name: /New…/ }));
    const nd = await screen.findByRole('dialog', { name: 'Start something new' });
    await user.click(within(nd).getByRole('button', { name: /Project with several pieces/ }));
    await user.click(await screen.findByRole('radio', { name: 'Compose' }));
    await openSheet(user);
    await addPiece(user);
    store.failModels = true;
    await user.click(screen.getByLabelText('More'));
    await user.click(await screen.findByRole('button', { name: /Project file/ }));
    expect(await screen.findByText(/^The file could not be made:/)).toBeTruthy();
  });

  it('English plurals: 1 day, 1 error', async () => {
    const { t } = await import('../src/core/i18n');
    expect(t('Last backup: {n|# day|# days} ago.', { n: 1 })).toBe('Last backup: 1 day ago.');
    expect(t('It has problems to fix: {n|# error|# errors}.', { n: 1 })).toBe(
      'It has problems to fix: 1 error.',
    );
  });
});

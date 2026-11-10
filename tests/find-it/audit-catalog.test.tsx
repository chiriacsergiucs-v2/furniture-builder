// @vitest-environment jsdom
// Find-it for ADR-262 (UI audit, Catalog and templates) at 1280 and 390 px: Use the imported one never loses the
// device's edit when the save fails, a file that is not a templates file says so, and the card buttons say which
// item they open.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp, WIDTHS } from './setup';

const flags = vi.hoisted(() => ({ failSaveTemplate: false }));
vi.mock('../../src/persist/db', async (orig) => {
  const real = await orig<typeof import('../../src/persist/db')>();
  return {
    ...real,
    saveTemplate: (...a: Parameters<typeof real.saveTemplate>) =>
      flags.failSaveTemplate
        ? Promise.reject(new Error('QuotaExceededError'))
        : real.saveTemplate(...a),
  };
});

const fileOf = (data: unknown, name = 'mobila-templates.json') =>
  new File([JSON.stringify(data)], name, { type: 'application/json' });

type User = Awaited<ReturnType<typeof renderApp>>['user'];
async function toCatalog(user: User) {
  await user.click(screen.getByRole('link', { name: /Catalog/ }));
  await screen.findByRole('heading', { level: 1, name: 'Catalog' });
}

describe.each(WIDTHS)('catalog at %ipx (find-it, ADR-262)', (width) => {
  it('Use the imported one with a failing save keeps the device’s edit', async () => {
    const { user } = await renderApp(width);
    const db = await import('../../src/persist/db');
    const { catalogFamilies } = await import('../../src/core/catalog');
    const { shadowOf } = await import('../../src/core/catalog/local');
    const fam = catalogFamilies[0];
    const mine = { ...shadowOf(fam), id: 'mine' };
    mine.family = { ...mine.family, name: 'My edited one' };
    await db.saveTemplate(mine);
    const theirs = { ...shadowOf(fam), id: 'theirs' };
    await toCatalog(user);
    const { useTemplates } = await import('../../src/store/templatesStore');
    await useTemplates.getState().refresh();
    flags.failSaveTemplate = true;
    try {
      await user.upload(
        screen.getByLabelText('Import templates'),
        fileOf({ kind: 'mobila-templates', templates: [theirs] }),
      );
      await user.click(await screen.findByRole('button', { name: 'Use the imported one' }));
      await waitFor(() => expect(screen.getByText(/0 templates imported/)).toBeTruthy());
    } finally {
      flags.failSaveTemplate = false;
    }
    expect((await db.listTemplates()).map((r) => r.id)).toEqual(['mine']);
  });

  it('a JSON file that is not a templates file says so', async () => {
    const { user } = await renderApp(width);
    await toCatalog(user);
    await user.upload(
      screen.getByLabelText('Import templates'),
      fileOf({ kind: 'furniture-builder-project', project: {} }, 'kitchen.json'),
    );
    expect(
      await screen.findByText('That file could not be read as a templates file.'),
    ).toBeTruthy();
  });

  it('each card’s Open button is described by its item', async () => {
    const { user } = await renderApp(width);
    await toCatalog(user);
    const open = (await screen.findAllByRole('button', { name: 'Open' }))[0];
    const id = open.getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)?.textContent?.trim()).toBeTruthy();
    const edit = screen.getAllByRole('button', { name: 'Edit template' })[0];
    expect(edit.getAttribute('aria-describedby')).toBeTruthy();
  });
});

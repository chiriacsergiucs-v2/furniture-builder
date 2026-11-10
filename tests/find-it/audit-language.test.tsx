// @vitest-environment jsdom
// Find-it for ADR-265 (UI audit, Language) at 1280 and 390 px: in Russian a new project is stored in English and shown
// in Russian on the Projects page; a language the browser cannot save does not reload and says so.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { openMore, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('language at %ipx (find-it, ADR-265)', (width) => {
  it('a new project is stored as "New project" and shown as «Новый проект»', async () => {
    localStorage.setItem('fb:lang', 'ru');
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Создать новый проект' }));
    const create = await screen.findByRole('dialog');
    await user.click(within(create).getByRole('button', { name: 'Создать проект' }));
    const { useDesign } = await import('../../src/store/designStore');
    await waitFor(() => expect(useDesign.getState().project).toBeTruthy());
    const db = await import('../../src/persist/db');
    await waitFor(async () => {
      const names = (await db.listProjects()).map((r) => r.name);
      expect(names).toContain('New project');
      expect(names).not.toContain('Новый проект');
    });
    await user.click(
      screen
        .queryAllByRole('link', { name: /Проекты/ })
        .concat(screen.queryAllByRole('button', { name: /^Проекты$/ }))[0],
    );
    const page = await screen.findByRole('main', { name: 'Проекты' });
    expect(within(page).getAllByText('Новый проект').length).toBeGreaterThan(0);
    expect(within(page).queryByText('New project')).toBeNull();
  });

  it('a language the browser cannot save does not reload and says so', async () => {
    const { user } = await renderApp(width);
    const { page } = await import('../../src/ui/shell/LanguageMenu');
    const reload = vi.spyOn(page, 'reload').mockImplementation(() => {});
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    try {
      await openMore(user, /^More$/);
      await user.click(
        within(screen.getByRole('group', { name: 'Language' })).getByRole('button', {
          name: 'Русский',
        }),
      );
    } finally {
      set.mockRestore();
    }
    expect(reload).not.toHaveBeenCalled();
    expect(
      screen.getByText('The language could not be saved in this browser’s storage.'),
    ).toBeTruthy();
  });
});

// @vitest-environment jsdom
// Find-it (ADR-108) for the language switches (ADR-153, ADR-154, ADR-157): from the bare app, by role and visible
// text, at phone and desktop widths.
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp, WIDTHS } from './setup';

async function openMore(user: Awaited<ReturnType<typeof renderApp>>['user'], name: RegExp) {
  await user.click(screen.getByLabelText(name));
}

describe.each(WIDTHS)('language at %i px', (width) => {
  it('More → Language → Русский saves ru and reloads', async () => {
    const { user } = await renderApp(width);
    const { page } = await import('../../src/ui/shell/LanguageMenu');
    const reload = vi.spyOn(page, 'reload').mockImplementation(() => {});
    await openMore(user, /^More$/);
    const group = screen.getByRole('group', { name: 'Language' });
    expect(within(group).getByRole('button', { name: 'English' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(within(group).getByRole('button', { name: 'Русский' }));
    expect(localStorage.getItem('fb:lang')).toBe('ru');
    expect(reload).toHaveBeenCalledOnce();
  });

  it('in Russian the places and the More menu are found by their Russian text', async () => {
    localStorage.setItem('fb:lang', 'ru');
    const { user } = await renderApp(width);
    expect(document.documentElement.lang).toBe('ru');
    const places = screen.getByRole('navigation', { name: 'Разделы' });
    for (const name of ['Проекты', 'Каталог', 'Редактор'])
      expect(within(places).getByRole('link', { name: new RegExp(name) })).toBeTruthy();
    await openMore(user, /^Ещё$/);
    expect(screen.getByRole('group', { name: 'Язык' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Информация и руководства/ })).toBeTruthy();
  });

  it('More → Print language → English is kept', async () => {
    const { user } = await renderApp(width);
    await openMore(user, /^More$/);
    const group = screen.getByRole('group', { name: /Print language/ });
    await user.click(within(group).getByRole('button', { name: 'English' }));
    expect(localStorage.getItem('fb:print-lang')).toBe('en');
    expect(within(group).getByRole('button', { name: 'English' }).getAttribute('aria-pressed')).toBe('true');
  });
});

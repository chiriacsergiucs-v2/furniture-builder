// @vitest-environment jsdom
// Find-it for the wizard labels and step titles (N344, N345), in jsdom (ADR-108): from the bare app, Catalog → New piece
// → each construction type → every step in the rail. The step titles, the labels 'Back panel', 'Modesty panel',
// 'Knob' and the option 'Open' are found by role and visible text, in English and in Russian (data-wizard.ts), and no
// "@@context" marker is ever visible (labels tagged @@wizard show the text before the marker).
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { data_wizard } from '../../src/core/i18n/ru/data-wizard';
import { renderApp, WIDTHS } from './setup';

type User = Awaited<ReturnType<typeof renderApp>>['user'];
type Lang = 'en' | 'ru';

const TITLES = ['Size', 'Type', 'Dividers', 'Contents', 'Doors', 'Base', 'Back', 'Review'];
const LABELS = ['Back panel@@wizard', 'Modesty panel@@wizard', 'Knob@@wizard', 'Open@@wizard'];
// Cabinet, Open shelving, Wardrobe, Bed, Desk: the types whose steps carry the four labels.
const TYPE_INDEX = [0, 1, 2, 3, 6];
const UI = {
  en: {
    catalog: /Catalog/,
    newPiece: 'New piece',
    rail: 'Wizard steps',
    types: 'Construction type',
  },
  ru: {
    catalog: /Каталог/,
    newPiece: 'Новое изделие',
    rail: 'Шаги мастера',
    types: 'Тип конструкции',
  },
};
const shown = (key: string, lang: Lang) =>
  lang === 'ru' ? (data_wizard[key] ?? key) : key.replace(/@@.*$/, '');

async function run(user: User, lang: Lang) {
  const ui = UI[lang];
  await user.click(await screen.findByRole('link', { name: ui.catalog }));
  await user.click(await screen.findByRole('button', { name: ui.newPiece }));
  const wiz = await screen.findByRole('dialog', { name: ui.newPiece });
  const rail = () => within(within(wiz).getByRole('list', { name: ui.rail }));
  const seen = new Set<string>();
  const found = new Set<string>();
  for (const index of TYPE_INDEX) {
    // Back to the Type step, choose the type, then visit every step the rail offers for it.
    await user.click(rail().getAllByRole('button')[0]);
    const group = within(wiz).getByRole('radiogroup', { name: ui.types });
    await user.click(within(group).getAllByRole('radio')[index]);
    const names = rail()
      .getAllByRole('button')
      .map((b) => (b.textContent ?? '').replace(/^\d+/, ''));
    for (const name of names) {
      await user.click(rail().getByRole('button', { name }));
      expect(within(wiz).getByRole('heading', { level: 3, name })).toBeTruthy();
      expect(wiz.textContent).not.toContain('@@');
      seen.add(name);
      for (const key of LABELS) {
        const text = shown(key, lang);
        if (
          within(wiz).queryAllByText(text).length ||
          within(wiz).queryAllByRole('radio', { name: text }).length ||
          within(wiz).queryAllByLabelText(text).length
        )
          found.add(key);
      }
    }
  }
  for (const title of TITLES)
    expect(seen.has(shown(title, lang)), `step title ${shown(title, lang)}`).toBe(true);
  for (const key of LABELS) expect(found.has(key), `label ${shown(key, lang)}`).toBe(true);
}

describe.each(WIDTHS)('wizard step titles and labels at %ipx (find-it, N344, N345)', (width) => {
  it('English: every step title; Back panel, Modesty panel, Knob and Open, no @@', async () => {
    const { user } = await renderApp(width);
    await run(user, 'en');
  });

  it('Russian: the same titles and labels from data-wizard.ts, no @@', async () => {
    localStorage.setItem('fb:lang', 'ru');
    const { user } = await renderApp(width);
    expect(shown('Knob@@wizard', 'ru')).toBe('Кнопка');
    await run(user, 'ru');
  });
});
